class SMPError extends Error {}
class InvalidState extends SMPError {}
class InvalidElement extends SMPError {}
class InvalidProof extends SMPError {}
class StateMemberNotFound extends SMPError {}

export { InvalidState, InvalidElement, InvalidProof, StateMemberNotFound };
