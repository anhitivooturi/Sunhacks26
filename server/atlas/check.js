// "Is my Atlas connection set up right?"  Run:  npm run check
// Prints what is wrong in plain words and never prints the password. Exit code 0 = healthy.
import 'dotenv/config'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
const dbName = process.env.MONGODB_DB || 'pulse'
const mask = u => u.replace(/(\/\/[^:/@]+:)[^@]+@/, '$1*****@')
const ok = m => console.log(`  ✓ ${m}`)
const bad = (m, fix) => { console.log(`  ✗ ${m}`); if (fix) console.log(`\n${fix.split('\n').map(l => '    ' + l).join('\n')}\n`); process.exitCode = 1 }

console.log('\nAtlas connection check\n')
if (!uri) {
  bad('MONGODB_URI is not set.', 'Create server/atlas/.env (copy .env.example) and add:\n  MONGODB_URI=mongodb+srv://<db_username>:<db_password>@<cluster>.mongodb.net/?appName=sunhacks\n\nIn Atlas: your cluster > Connect > Drivers > Node.js, copy the string,\nthen replace <db_password> with your DATABASE USER password (not your Atlas login).')
  process.exit()
}
if (!/^mongodb(\+srv)?:\/\//.test(uri)) { bad('MONGODB_URI does not start with mongodb:// or mongodb+srv://', 'Copy it again from Atlas > Connect > Drivers. Do not wrap it in quotes inside .env.'); process.exit() }
if (/<db_password>|<password>/.test(uri)) { bad('The connection string still contains <db_password>.', 'Replace the placeholder with your database user’s password. Special characters like @ # / : must be URL-encoded (@ = %40, # = %23).'); process.exit() }
ok(`found MONGODB_URI  ${mask(uri)}`)

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 })
try {
  await client.connect()
  ok('reached the cluster and logged in')
  const db = client.db(dbName)
  await db.command({ ping: 1 }); ok('ping works')

  const probe = db.collection('_connection_check')
  await probe.insertOne({ at: new Date() }); await probe.deleteMany({}); ok(`can read and write in database "${dbName}"`)
  await db.dropCollection('_connection_check').catch(() => {})

  const have = (await db.listCollections().toArray()).map(c => c.name)
  for (const c of ['student_settings', 'notes', 'question_threads']) {
    const n = have.includes(c) ? await db.collection(c).estimatedDocumentCount() : 0
    console.log(`    ${have.includes(c) ? '•' : '○'} ${c}${have.includes(c) ? `  (${n} documents)` : '  (created on first save)'}`)
  }
  console.log('\nAll good. Start the service with  npm run dev  and open  http://localhost:3001/api/student/health  (it should say "store":"atlas").\n')
} catch (e) {
  const msg = String(e.message || e)
  if (/bad auth|authentication failed|code: 18|AuthenticationFailed/i.test(msg) || e.code === 18) {
    bad('Atlas said the username or password is wrong.', 'Use the DATABASE USER from Atlas > Database Access (not your Atlas login).\nIf the password has special characters, URL-encode them (@ = %40, # = %23, / = %2F).\nThe user also needs the "Read and write to any database" role.')
  } else if (/ENOTFOUND|querySrv|EREFUSED|ECONNREFUSED.*_mongodb/i.test(msg)) {
    bad('Could not find the cluster address (DNS lookup failed).', 'Check the host part of the string (e.g. sunhacks.xxxxx.mongodb.net) against Atlas > Connect.\nSome networks block the SRV lookup that mongodb+srv:// needs. Try another network or a phone hotspot,\nor in Atlas choose an older driver version to get the non-SRV mongodb:// string.')
  } else if (/timed out|ReplicaSetNoPrimary|ETIMEDOUT|Server selection|ssl|tls/i.test(msg)) {
    bad('Reached the internet but Atlas did not let this computer in (or the connection timed out).', 'Atlas > Network Access > Add IP Address > "Add current IP address".\nOn conference Wi-Fi your IP is different, so add that network too\n(or temporarily allow 0.0.0.0/0 for the demo and delete it afterwards).\nAlso confirm the cluster is not paused and port 27017 is not blocked on this network.')
  } else {
    bad(`Unexpected error: ${msg.split('\n')[0]}`, 'Copy this line (it has no password in it) when asking for help.')
  }
} finally {
  await client.close().catch(() => {})
}
