import * as socketIO from "socket.io";
import { Server, Socket } from "socket.io";
import {
  ACTION,
  ERROR,
  SOCKET_ACTIONS,
} from "./constants";
import {
  ErrorData,
  SocketData,
  SocketStreamIceData,
  SocketStreamSdpData,
  RoomInput,
  RoomParticipants, SocketRoomData,
} from "./interfaces";

type ApiRequest = (json:{}, socket?:Socket)=>{}|void

export class SocketServer implements Record<ACTION, ApiRequest> {
    private readonly io:Server;

    constructor(server) {
      const socketServer = this;
      this.io = socketIO(server);
      this.io.on("connection", (socket:Socket) => {
        SocketServer.socketLog("connected", socket, Object.keys(socketServer.io.sockets.connected));
        for (const action of SOCKET_ACTIONS) {
          socket.on(action, async (json, callback) => {
            if (typeof json === "string") {
              json = JSON.parse(json);
            }
            SocketServer.socketLog("got message", socket, action, JSON.stringify(json));
            const response = (data) => {
              if (!callback) {
                SocketServer.socketError("no ackres", socket, action, JSON.stringify(data));
                return;
              }
              callback(data);
              SocketServer.socketLog("sent message", socket, action, JSON.stringify(data));
            };
            const error = (errorId: ERROR, error?) => {
              response({ errorId: errorId || ERROR.UNKNOWN, error } as ErrorData);
            };
            try {
              response(await socketServer[action](json, socket));
            } catch (err) {
              if (err) {
                SocketServer.socketError("error", socket, action, JSON.stringify(err));
              }
              error(err.errorId, err.message);
            }
          });
        }
        socket.on("disconnecting", async () => {
          SocketServer.socketLog("disconnecting", socket, socket.rooms);
          for (const _roomId in socket.rooms) {
            if (socket.rooms.hasOwnProperty(_roomId) && _roomId.startsWith(SocketServer.roomId())) {
              const roomId:string = _roomId.substr(SocketServer.roomId().length);
              socketServer[ACTION.LEAVE_ROOM]({ roomId }, socket);
            }
          }
        });
        socket.on("disconnect", async () => {
          SocketServer.socketLog("disconnected", socket, Object.keys(socketServer.io.sockets.connected));
        });
      });
    }

    static trowError(errorId:ERROR, message?:string):never {
      throw { errorId, message };
    }

    static socketLog(action, socket:Socket, ...args) {
      console.log(action, socket.id, socket.request.user, ...args);
    }

    static socketError(action, socket:Socket, ...args) {
      console.error(action, socket.id, socket.request.user, ...args);
    }

    [ACTION.ROOM_PARTICIPANTS]({ roomId }:RoomInput):RoomParticipants {
      const room = SocketServer.roomId(roomId);
      const socketRoom = this.io.sockets.adapter.rooms[room];
      return { participants: Object.keys((socketRoom && socketRoom.sockets) || {})
        .map((socketId) => ({ socketId })) };
    }

    [ACTION.JOIN_ROOM]({ roomId }:RoomInput, socket:Socket):void{
      const room = SocketServer.roomId(roomId);
      socket.join(room);
      const data:SocketRoomData = { socketId: socket.id, roomId };
      socket.to(room).emit(ACTION.JOIN_ROOM, data);
      SocketServer.socketLog("broadcast", socket, ACTION.JOIN_ROOM, data);
    }

    [ACTION.LEAVE_ROOM]({ roomId }:RoomInput, socket:Socket):void{
      const room = SocketServer.roomId(roomId);
      socket.leave(room);
      const data:SocketRoomData = { socketId: socket.id, roomId };
      socket.to(room).emit(ACTION.LEAVE_ROOM, data);
      SocketServer.socketLog("broadcast", socket, ACTION.LEAVE_ROOM, data);
    }

    [ACTION.ICE](json:SocketStreamIceData, socket:Socket):void {
      this.pipeSocketData(ACTION.ICE, json, socket);
    }

    [ACTION.SDP](json:SocketStreamSdpData, socket:Socket):void {
      this.pipeSocketData(ACTION.SDP, json, socket);
    }

    [ACTION.STREAM_ENDED]({ roomId }:SocketRoomData, socket:Socket):void {
      const room = SocketServer.roomId(roomId);
      if (this.io.sockets.adapter.rooms[room]) {
        socket.to(room).emit(ACTION.STREAM_ENDED, { socketId: socket.id } as SocketData);
      }
    }

    private pipeSocketData(action, json:SocketData, socket):void{
      const s = this.io.sockets.connected[json.socketId];
      if (s) {
        json.socketId = socket.id;
        s.emit(action, json);
        SocketServer.socketLog("pipe message", s, action, JSON.stringify(json));
      } else {
        SocketServer.trowError(ERROR.INVALID_SOCKET_ID);
      }
    }

    private static roomId(id = "") {
      return `room:${id}`;
    }
}
