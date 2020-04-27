class BaseSMPError extends Error {}

class SMPStateError extends BaseSMPError {}
class InvalidState extends SMPStateError {}
class InvalidElement extends SMPStateError {}
class InvalidProof extends SMPStateError {}
class StateMemberNotFound extends SMPStateError {}
class SMPNotFinished extends SMPStateError {}

class NotImplemented extends BaseSMPError {}

class ParsingError extends BaseSMPError {}
class ValueError extends ParsingError {}

class NetworkingError extends BaseSMPError {}
class FailedToReadData extends NetworkingError {}


export {
  InvalidState,
  InvalidElement,
  InvalidProof,
  StateMemberNotFound,
  NotImplemented,
  ValueError,
  SMPNotFinished,
  FailedToReadData,
  SMPStateError,
};
