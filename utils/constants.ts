export enum ACTION {
    ICE="ice",
    SDP="sdp",
    STREAM_ENDED="streamEnded",
    JOIN_ROOM="joinRoom",
    LEAVE_ROOM="leaveRoom",
    ROOM_PARTICIPANTS="roomParticipants"
}
export const SOCKET_ACTIONS=Object.values(ACTION);
export enum ERROR {UNKNOWN,INVALID_SOCKET_ID}