
import { Server } from 'socket.io';

let io;


export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    console.log('✅ Socket.io initialized');

    io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id);

        // Join a room (e.g., "instituteId-class-section" or "user-role-id")
        socket.on('join_room', (room) => {
            if (room) {
                socket.join(room);
                console.log(`👤 Socket ${socket.id} joined room: ${room}`);
            }
        });

        socket.on('disconnect', () => {
            console.log('❌ Client disconnected:', socket.id);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Helper to emit to a specific class section
export const emitToClass = (instituteId, className, section, event, data) => {
    try {
        const room = `${instituteId}-${className}-${section}`;
        const ioInstance = getIO();
        ioInstance.to(room).emit(event, data);
        console.log(`📡 Emitted '${event}' to room '${room}'`);
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

export const emitToTeacher = (instituteId, event, data) => {
    try {
        const room = `teacher-${instituteId}`;
        const ioInstance = getIO();
        ioInstance.to(room).emit(event, data);
        console.log(`📡 Emitted '${event}' to teacher room '${room}'`);
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

export const emitToAllStudents = (instituteId, event, data) => {
    try {
        const room = `students-${instituteId}`;
        const ioInstance = getIO();
        ioInstance.to(room).emit(event, data);
        console.log(`📡 Emitted '${event}' to all students room '${room}'`);
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

export const emitToSpecificTeacher = (teacherId, event, data) => {
    try {
        const room = `teacher-${teacherId}`;
        const ioInstance = getIO();
        ioInstance.to(room).emit(event, data);
        console.log(`📡 Emitted '${event}' to specific teacher room '${room}'`);
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

export const emitToPrincipal = (instituteId, event, data) => {
    try {
        const room = `principal-${instituteId}`;
        const ioInstance = getIO();
        ioInstance.to(room).emit(event, data);
        console.log(`📡 Emitted '${event}' to principal room '${room}'`);
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

export const emitToStudent = (studentId, event, data) => {
    try {
        const room = `student-${studentId}`;
        const ioInstance = getIO();
        ioInstance.to(room).emit(event, data);
        console.log(`📡 Emitted '${event}' to student room '${room}'`);
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

export const emitToAdmin = (event, data) => {
    try {
        const room = 'admin_room';
        const ioInstance = getIO();
        ioInstance.to(room).emit(event, data);
        console.log(`📡 Emitted '${event}' to admin room '${room}'`);
    } catch (error) {
        console.error('Socket emit error:', error);
    }
};

