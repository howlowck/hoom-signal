require('dotenv').config();
var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

http.listen(process.env.PORT || 3003);

io
    .of('/signal')
    .on('connection', (socket) => {
        socket.on('command:join-room', (payload) => {
            const room = payload.room
            const name = payload.name
            socket.join(room)
            // console.log(`${name} joined room ${room}`)
            socket.emit('self:joined-room', {
                room
            })
            socket.broadcast.to(room).emit('member:joined-room', {
                id: socket.id,
                name
            })
        })

        socket.on('disconnecting', (reason) => {
            // console.log(reason);
            let rooms = Object.keys(socket.rooms);
            rooms.forEach((room) => {
                socket.broadcast.to(room).emit('member:left-room', {
                    id: socket.id
                })
            })
        })

        socket.on('send:to-room', (msg) => {
            const room = msg.room
            const subject = msg.subject
            const payload = msg.payload
            socket.broadcast.to(room).emit(subject, payload)
        })

        socket.on('send:to-members', (msg) => {
            const socketIds = msg.memberIds
            socketIds.forEach((socketId) => {
                // console.log(`sending private message to ${socketId} from ${socket.id}`)
                socket.to(socketId).emit(msg.subject, msg.payload)
            })
        })
        
    })