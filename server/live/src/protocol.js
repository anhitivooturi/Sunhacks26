// The checked-in team contract uses {type, data} on the wire. Internal room
// helpers keep flat objects so that persistence and scoring stay independent.
export function packMessage({ type, ...data }) {
  return { type, data };
}

export function unpackMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string' ||
      Object.keys(message).some(key => !['type', 'data'].includes(key)) ||
      !message.data || typeof message.data !== 'object' || Array.isArray(message.data) || 'type' in message.data) {
    throw new Error('Expected {type,data:{...}}');
  }
  return { ...message.data, type: message.type };
}
