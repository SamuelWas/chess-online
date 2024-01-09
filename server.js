const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const port = 3000;
const session = require("express-session");
const hash = require("pbkdf2-password")();
const mongoose = require("mongoose");
const { Chess } = require("chess.js");
const { Server } = require("socket.io");

// Chess
const chessGames = {};

// config
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// middleware
app.use(express.urlencoded({ extended: false }));
const sessionMiddleware = session({
	resave: false, // don't save session if unmodified
	saveUninitialized: false, // don't create session until something stored
	secret: "shhhh, very secret",
});
app.use(sessionMiddleware);

app.use(function (req, res, next) {
	const err = req.session.error;
	const msg = req.session.success;
	delete req.session.error;
	delete req.session.success;
	res.locals.message = "";
	if (err) res.locals.message = '<p class="msg error">' + err + "</p>";
	if (msg) res.locals.message = '<p class="msg success">' + msg + "</p>";
	next();
});

// socket.io
const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: "*" },
});

io.engine.use(sessionMiddleware);

io.on("connection", socket => {
	console.log(`a user connected: ${socket.id}`);

	socket.on("join", async (roomId, cb) => {
		const room = await Room.findOne({ id: roomId });
		if (!room) {
			cb("The room you tryed to enter does not exist!");
			return;
		}

		const session = socket.request.session;
		if (!session) return;
		if (!session.user) return;

		const username = session.user.username;

		// const otherRoom = await Room.findOne({
		// 	$or: [{ blackPlayer: username }, { whitePlayer: username }],
		// 	id: { $ne: roomId },
		// });
		// if (otherRoom) {
		// 	cb(`You are already on the room ${otherRoom.id}!`);
		// 	return;
		// }

		// room.lastActivity = null;

		const isAlreadyInRoom = room.whitePlayer === username || room.blackPlayer === username;
		if (!isAlreadyInRoom) {
			if (!room.whitePlayer) {
				room.whitePlayer = username;
			} else if (!room.blackPlayer) {
				room.blackPlayer = username;
			} else {
				return;
			}
			await room.save();

			console.log(`user ${username} joined room ${roomId}`);
		}

		socket.join(roomId);
		socket.join(username);

		io.to(username).emit("gameStatus", {
			fen: room.fen,
			whitePlayer: room.whitePlayer,
			blackPlayer: room.blackPlayer,
			orientation: room.whitePlayer === username ? "w" : "b",
		});
	});

	socket.on("gameMove", async tryMove => {
		const { roomId } = tryMove;
		const room = await Room.findOne({ id: roomId });

		if (!room) return;

		const chess = new Chess(room.fen);
		const username = socket.request.session.user.username;
		if (chess.turn() === "w" && room.whitePlayer !== username) return;
		if (chess.turn() === "b" && room.blackPlayer !== username) return;

		try {
			chess.move(tryMove);
		} catch (e) {}

		room.fen = chess.fen();
		room.save();

		io.to(roomId).emit("gameStatus", {
			fen: room.fen,
			whitePlayer: room.whitePlayer,
			blackPlayer: room.blackPlayer,
		});
	});

	// socket.on("disconnect", async () => {
	// 	if (!socket.request.session.user) return;
	// 	const username = socket.request.session.user.username;

	// 	await Room.findOneAndUpdate(
	// 		{ $or: [{ blackPlayer: username }, { whitePlayer: username }] },
	// 		{ lastActivity: new Date() }
	// 	);
	// 	console.log(`user ${username} disconnected`);

	// if (room) {
	// 	if (room.whitePlayer === username) {
	// 		room.whitePlayer = null;
	// 	} else {
	// 		room.blackPlayer = null;
	// 	}
	// 	if (!room.whitePlayer && !room.blackPlayer) {
	// 		await Room.deleteOne({ id: room.id });
	// 		console.log(`room ${room.id} deleted`);
	// 	} else {
	// 		room.save();
	// 		console.log(`user ${username} disconnected from room ${room.id}`);
	// 	}
	// }
	// });

	// setInterval(async () => {
	// 	const { deletedCount } = await Room.deleteMany({
	// 		lastActivity: {
	// 			$lt: new Date(Date.now() - 10 * 60 * 1000),
	// 			$exists: true,
	// 		},
	// 	});

	// 	if (deletedCount) {
	// 		console.log(`${deletedCount} rooms deleted`);
	// 	}
	// }, 1000);
});

// Database
main().catch(err => console.log(err));

async function main() {
	await mongoose.connect("mongodb://127.0.0.1:27017/chessClone");
}

const userSchema = new mongoose.Schema({
	username: String,
	salt: String,
	hash: String,
	email: String,
});

const User = mongoose.model("User", userSchema);

const roomSchema = new mongoose.Schema({
	id: String,
	fen: String,
	whitePlayer: String,
	blackPlayer: String,
	// lastActivity: Date,
});

const Room = mongoose.model("Room", roomSchema);

initializeDB();

// Routes
app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", function (req, res) {
	if (req.session.user) {
		res.redirect("/home");
		return;
	}
	res.render("login");
});

app.get("/register", function (req, res) {
	res.render("register");
});

app.post("/login", function (req, res, next) {
	authenticate(req.body.username, req.body.password, function (err, user) {
		if (err) return next(err);
		if (user) {
			// Regenerate session when signing in
			// to prevent fixation
			req.session.regenerate(function () {
				// Store the user's primary key
				// in the session store to be retrieved,
				// or in this case the entire user object
				req.session.user = user;
				res.redirect("/home");
			});
		} else {
			req.session.error = "Authentication failed, please check your username and password.";
			res.redirect("/login");
		}
	});
});

app.post("/register", function (req, res, next) {
	register(req.body.username, req.body.email, req.body.password, function (err) {
		if (err) {
			req.session.error = err;
			res.redirect("back");
		} else {
			req.session.success = "Cadastro realizado com sucesso! Efetue o login.";
			res.redirect("/login");
		}
	});
});

app.get("/home", restrict, (req, res) => {
	res.render("home", { user: req.session.user });
});

app.post("/createRoom", restrict, async (req, res) => {
	let roomId = generateId();
	let room = await Room.findOne({ id: roomId });
	while (room) {
		roomId = generateId();
		room = await Room.findOne({ id: roomId });
	}

	chessGames[roomId] = new Chess();

	const newRoom = new Room({ id: roomId, fen: chessGames[roomId].fen() });
	await newRoom.save();

	res.redirect(`/room/${roomId}`);
});

app.get("/room/:roomId", restrict, async (req, res) => {
	const roomId = req.params.roomId;

	const room = await Room.findOne({ id: roomId });

	if (!room) {
		req.session.error = "The room you tryed to enter does not exist!";
		res.redirect("/home");
		return;
	}

	const user = req.session.user;
	if (
		room.whitePlayer &&
		room.blackPlayer &&
		room.whitePlayer !== user.username &&
		room.blackPlayer !== user.username
	) {
		req.session.error = "The room you tryed to enter is full!";
		res.redirect("/home");
		return;
	}

	res.render("room", { user: user });
});

app.get("/logout", (req, res) => {
	req.session.destroy(() => res.redirect("/"));
});

server.listen(port, () => console.log(`Server is running at http://localhost:${port}`));

function generateId() {
	const length = 8;
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	let result = "";

	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * chars.length);
		result += chars.charAt(randomIndex);
	}

	return result;
}

async function initializeDB() {
	const admin = await User.findOne({ username: "admin" });
	if (!admin) {
		hash({ password: "admin" }, function (err, pass, salt, hash) {
			if (err) throw err;
			const admin = new User({ username: "admin", salt: salt, hash: hash });

			admin.save();
		});
	}
}

async function authenticate(username, pass, fn) {
	const user = await User.findOne({ username: username });
	// query the db for the given username
	if (!user) return fn(null, null);
	// apply the same algorithm to the POSTed password, applying
	// the hash against the pass / salt, if there is a match we
	// found the user
	hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
		if (err) return fn(err);
		if (hash === user.hash) return fn(null, user);
		fn(null, null);
	});
}

async function register(username, email, password, fn) {
	const isUsernameTaken = await User.findOne({ username: username });
	if (isUsernameTaken) return fn("Username is taken");

	const isEmailTaken = await User.findOne({ email: email });
	if (isEmailTaken) return fn("This Email is already in use");

	hash({ password: password }, function (err, pass, salt, hash) {
		if (err) throw err;

		const newUser = new User({ username: username, email: email, salt: salt, hash: hash });

		newUser.save();

		fn(null);
	});
}

function restrict(req, res, next) {
	if (req.session.user) {
		next();
	} else {
		req.session.error = "Access denied!";
		res.redirect("/login");
	}
}
