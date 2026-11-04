/**
 * Chat & Typing Presence Service for Real-Time Coach/Athlete Communication
 */
const typingMap = new Map();

function getTypingKey(senderId, recipientId) {
  return `${senderId}:${recipientId}`;
}

function setTyping(senderId, recipientId, isTyping) {
  if (!senderId || !recipientId) return;
  const key = getTypingKey(senderId, recipientId);
  if (isTyping) {
    typingMap.set(key, Date.now());
  } else {
    typingMap.delete(key);
  }
}

function isTyping(senderId, recipientId) {
  if (!senderId || !recipientId) return false;
  const key = getTypingKey(senderId, recipientId);
  const timestamp = typingMap.get(key);
  if (!timestamp) return false;
  if (Date.now() - timestamp > 4000) {
    typingMap.delete(key);
    return false;
  }
  return true;
}

function clearTyping(senderId, recipientId) {
  if (!senderId || !recipientId) return;
  typingMap.delete(getTypingKey(senderId, recipientId));
}

module.exports = {
  setTyping,
  isTyping,
  clearTyping
};
