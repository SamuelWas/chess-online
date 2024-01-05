const express = require("express");
const app = express();
const path = require("path");
const port = 3000;
const session = require("express-session");
const hash = require("pbkdf2-password")();
const mongoose = require("mongoose");

// config
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// middleware
app.use(express.urlencoded({ extended: false }));
app.use(
	session({
		resave: false, // don't save session if unmodified
		saveUninitialized: false, // don't create session until something stored
		secret: "shhhh, very secret",
	})
);

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

// database
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

initializeDB();

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", function (req, res) {
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

app.get("/room", restrict, (req, res) => {
	res.render("room", { user: req.session.user });
});

app.get("/logout", (req, res) => {
	req.session.destroy(() => res.redirect("/"));
});

app.listen(port, () => console.log(`Server is running at http://localhost:${port}`));

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
