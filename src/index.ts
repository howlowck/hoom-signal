import { config } from 'dotenv'
config()
import winston from 'winston'
import express from 'express'
import { createServer } from 'http'
import socketio from 'socket.io'

const app = express()
const server = createServer(app)
const io = socketio(server, {
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Origin": req.headers.origin,
      "Access-Control-Allow-Credentials": true
    })
    res.end()
  }
});

const silenceLog = process.env.LOGGING_SILENT === 'true' 

const logger = winston.createLogger({
  silent: silenceLog,
  transports: [
    new winston.transports.Console(),
  ]
})

const port = process.env.PORT || 3003
server.listen(port, () => {
  console.log('listening to port:', port)
});

export type MemberInfo = {
  id: string,
  name: string,
  metadata?: { [key: string]: any }
}

export type RoomInfo = {
  name: string,
  key: string | null,
  metadata?: { [key: string]: any }
  members: MemberInfo[]
}

export type AppState = {
  rooms: RoomInfo[]
}

export type SendToMembersPayload = {
  memberIds: string[],
  subject: string,
  payload: any
}

export type JoinRoomEvent = {
  room: string,
  name: string,
  metadata?: { [key: string]: any }
}

export type MemberJoinedRoomEvent = {
  memberId: string,
  name: string,
  members: MemberInfo[]
}

export type MemberLeftRoomEvent = {
  memberId: string,
  members: MemberInfo[]
}

export type NotificationEvent = {
  type: "info" | "emergency" | "error",
  message: string,
  timestamp: string
}

const appState: AppState = {
  rooms: [
    {
      name: 'general',
      key: null,
      members: []
    }
  ]
}

function addMember(rooms: RoomInfo[], roomName: string, member: MemberInfo): { rooms: RoomInfo[], roomChanged: RoomInfo } {
  const room: RoomInfo = rooms.find(_ => _.name === roomName) ?? { name: roomName, key: "", members: [] }
  room.members = [
    ...room.members,
    member
  ]
  return { rooms, roomChanged: room }
}

function removeMember(rooms: RoomInfo[], roomName: string, memberId: string): { rooms: RoomInfo[], roomChanged: RoomInfo } {
  const room = rooms.find(_ => _.name === roomName) ?? { name: roomName, key: "", members: [] }
  room.members = room.members.filter(_ => _.id !== memberId)
  return { rooms, roomChanged: room }
}

io
  .of('/signal')
  .on('connection', (socket) => {
    socket.on('command:join-room', (payload: JoinRoomEvent) => {
      const room = payload.room
      const name = payload.name
      const metadata = payload.metadata
      socket.join(room)
      logger.info(`${name} joined room ${room}`)
      socket.emit('self:joined-room', {
        room
      })

      const { rooms, roomChanged } = addMember(appState.rooms, room, { id: socket.id, name, metadata })
      appState.rooms = rooms

      const joinedRoomEvent: MemberJoinedRoomEvent = {
        memberId: socket.id,
        name,
        members: roomChanged.members
      }

      socket.broadcast.to(room).emit('member:joined-room', joinedRoomEvent)
    })

    socket.on('disconnecting', (reason) => {
      logger.info(reason);
      let rooms = Object.keys(socket.rooms);

      rooms.forEach(room => {
        const { rooms, roomChanged } = removeMember(appState.rooms, room, socket.id)
        appState.rooms = rooms
        const event: MemberLeftRoomEvent = {
          memberId: socket.id,
          members: roomChanged.members
        };
        socket.broadcast.to(room).emit('member:left-room', event)
      })
    })

    socket.on('send:to-room', (msg) => {
      const room = msg.room
      const subject = msg.subject
      const payload = msg.payload
      socket.broadcast.to(room).emit(subject, payload)
    })

    socket.on('send:to-members', (msg: SendToMembersPayload) => {
      const socketIds = msg.memberIds
      socketIds.forEach((socketId) => {
        logger.info(`sending private message to ${socketId} from ${socket.id}`)
        socket.to(socketId).emit(msg.subject, msg.payload)
      })
    })
  })
