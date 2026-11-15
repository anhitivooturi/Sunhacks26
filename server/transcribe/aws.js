import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

export async function createAwsStream({ env = process.env } = {}) {
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION;
  if (!region) throw new Error('Set AWS_REGION (for example us-east-1) on the server');
  let credentials;
  try {
    credentials = env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}) }
      : await fromNodeProviderChain({ clientConfig: { region } })();
  } catch { throw new Error('AWS API credentials are missing or expired. Configure server environment credentials or an AWS profile.'); }
  const client = new TranscribeStreamingClient({ region, credentials, maxAttempts: 1 });
  return {
    async *run(audio, signal) {
      const AudioStream = (async function* () { for await (const AudioChunk of audio) yield { AudioEvent: { AudioChunk } }; })();
      const response = await client.send(new StartStreamTranscriptionCommand({ LanguageCode: 'en-US', MediaEncoding: 'pcm', MediaSampleRateHertz: 16000, AudioStream }), { abortSignal: signal });
      for await (const event of response.TranscriptResultStream) {
        if (!event.TranscriptEvent) {
          if (Object.keys(event).some(k => k.endsWith('Exception'))) throw new Error('Transcribe stream failed');
          continue;
        }
        for (const r of event.TranscriptEvent.Transcript?.Results || []) {
          const text = r.Alternatives?.[0]?.Transcript?.trim();
          if (text) yield { id: r.ResultId, text, final: !r.IsPartial, startSec: r.StartTime ?? 0, endSec: r.EndTime ?? r.StartTime ?? 0 };
        }
      }
    },
    close() { client.destroy(); },
  };
}
