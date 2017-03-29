const EventEmitter = require('events');
const debug = require('debug')('eqws-adapter');

class Adapter extends EventEmitter {
	constructor(wss, opts = {}) {
		super();

		this._sids = {};
		this._rooms = {};
		this._options = opts;
		this._wss = wss;
	}

	join(socketId, room) {
		return this.joinAll(socketId, [room]);
	}

	joinAll(socketId, rooms) {
		return new Promise((resolve, reject) => {
			for (let i = 0; i < rooms.length; i++) {
				const room = rooms[i];

				debug('socket=%s join to room=%s', socketId, room);

				this._sids[socketId] = this._sids[socketId] || {};
				this._sids[socketId][room] = true;

				this._rooms[room] = this._rooms[room] || {};
				this._rooms[room][socketId] = true;
			}

			process.nextTick(resolve);
		});
	}

	leave(socketId, room) {
		return new Promise((resolve, reject) => {
			debug('socket=%s leave from room=%s', socketId, room);

			this._sids[socketId] = this._sids[socketId] || {};
			delete this._sids[socketId][room];

			if (Object.keys(this._sids[socketId]).length === 0) {
				delete this._sids[socketId];
			}

			if (this._rooms.hasOwnProperty(room)) {
				delete this._rooms[room][socketId];

				if (Object.keys(this._rooms[room]).length === 0) {
					delete this._rooms[room];
				}
			}

			process.nextTick(resolve);
		});
	}

	leaveAll(socketId) {
		return new Promise((resolve, reject) => {
			const rooms = this._sids[socketId];

			debug('socket=%s leave from all rooms', socketId);

			if (!rooms) return process.nextTick(resolve);

			for(let room in rooms) {
				if (this._rooms.hasOwnProperty(room)) continue;

				delete this._rooms[room][socketId];

				if (Object.keys(this._rooms[room]).length === 0) {
					delete this._rooms[room];
				}
			}

			delete this._sids[socketId];
			process.nextTick(resolve);
		});
	}

	clients(rooms) {
		// Adapt rooms array
		if (!Array.isArray(rooms)) rooms = [rooms];

		return new Promise((resolve, reject) => {
			const sids = [];
			const ids = {};

			for (let room in rooms) {
				const list = this._rooms[room];

				for (let socketId in list) {
					if (ids[socketId]) continue;
					sids.push(socketId);
					ids[socketId] = true;
				}
			}

			process.nextTick(resolve.bind(null, sids));
		});
	}

	clientRooms(socketId) {
		return new Promise((resolve, reject) => {
			const rooms = this._sids[socketId];
			process.nextTick(resolve.bind(null, rooms ? Object.keys(rooms) : null));
		});
	}

	broadcast(packet, rooms) {
		// Adapt rooms array
		if (!Array.isArray(rooms)) rooms = [rooms];

		const sids = {};

		for (let i = 0; i < rooms.length; i++) {
			const room = rooms[i];
			const sockets = this._rooms[room];

			debug('broadcast room=%s', room);

			if (!sockets) continue;

			for (let socketId in sockets) {
				if (sids[socketId]) continue;

				const socket = this._wss._connected[socketId];

				if (socket) {
					socket.send(packet);
					sids[socketId] = true;
				} else {
					delete this._rooms[room][socketId];
					delete this._sids[socketId];
				}
			}
		}
	}
}

module.exports = Adapter;