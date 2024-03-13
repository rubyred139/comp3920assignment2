require("./utils");

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const saltRounds = 12;

include("database/db_utils");
include("databaseConnection");
const db_users = include("database/users");
const groups = include("database/groups");
const db_msg = include("database/messages");
const db_emoji = include("database/sendEmoji");

const port = process.env.PORT || 3060;

const app = express();

const expireTime = 60 * 60 * 1000; //expires after an hour  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
	crypto: {
		secret: mongodb_session_secret,
	},
});

app.use(
	session({
		secret: node_session_secret,
		store: mongoStore, //default is memory store
		saveUninitialized: false,
		resave: true,
	})
);
// app.use("/", sessionValidation);
app.get("/", (req, res) => {
	const authenticated = req.session.authenticated;
	res.render("index", {
		authenticated: authenticated,
	});
});

app.get("/signup", (req, res) => {
	res.render("signup", { errMsg: false });
});

app.get("/login", (req, res) => {
	res.render("login");
});

app.post("/submitUser", async (req, res) => {
	var username = req.body.username;
	var email = req.body.email;
	var password = req.body.password;

	if (!username || !email || !password) {
		// Create an object to hold the missing fields
		const missingFields = {};

		// Add missing fields to the object
		if (!username) {
			missingFields.username = "Username";
		}
		if (!email) {
			missingFields.email = "Email";
		}
		if (!password) {
			missingFields.password = "Password";
		}

		// Generate the error message
		const errorMessage = Object.entries(missingFields)
			.map(([field, label]) => `${label} is required`)
			.join(". ");

		// Render the error message with a link back to the login page
		res.render("signup", { errMsg: errorMessage });
		return;
	}

	var hashedPassword = bcrypt.hashSync(password, saltRounds);

	var success = await db_users.createUser({
		user: username,
		email: email,
		hashedPassword: hashedPassword,
	});

	if (success) {
		var results = await db_users.getUsers();

		req.session.authenticated = true;
		req.session.email = email;
		req.session.username = username;
		res.redirect("/members");
	} else {
		res.render("errorMessage", { error: "Failed to create user." });
	}
});

app.post("/loggingin", async (req, res) => {
	var username = req.body.username;
	var password = req.body.password;
	if (!username || !password) {
		// Create an object to hold the missing fields
		const missingFields = {};

		// Add missing fields to the object
		if (!username) {
			missingFields.username = "Username";
		}
		if (!password) {
			missingFields.password = "Password";
		}

		// Generate the error message
		const errorMessage = Object.entries(missingFields)
			.map(([field, label]) => `${label} is required`)
			.join(". ");

		const html = `
		<p>${errorMessage}</p>
		<a href="/login">Try again</a>
		`;
		res.send(html);
		return;
	}

	var results = await db_users.getUser({
		user: username,
		hashedPassword: password,
	});

	if (results) {
		// console.log("results: " + results);
		if (results.length == 1) {
			//there should only be 1 user in the db that matches
			if (bcrypt.compareSync(password, results[0].password)) {
				req.session.authenticated = true;
				req.session.username = username;
				req.session.userId = results[0].user_id;
				req.session.cookie.maxAge = expireTime;

				res.render("members", {
					authenticated: true,
					user: username,
				});
				return;
			} else {
				console.log("invalid password");
				return;
			}
		} else {
			console.log(
				"invalid number of users matched: " +
					results.length +
					" (expected 1)."
			);
			res.redirect("/login");
			return;
		}
	}

	console.log("user not found");
	//user and password combination not found
	res.redirect("/login");
});

app.get("/members", (req, res) => {
	var username = req.session.username;
	res.render("members", {
		authenticated: req.session.authenticated,
		user: username,
	});
});

app.use("/chatGroups", sessionValidation);
app.get("/chatGroups", async (req, res) => {
	var userId = req.session.userId;
	var groupData = await groups.viewChatGroups(userId);
	// await db_msg.clearUnread();

	res.render("chatGroups", { groups: groupData });
});

app.get("/chatGroups/:groupId", async (req, res) => {
	var groupId = req.params.groupId;
	var userId = req.session.userId;
	var roomId = req.params.groupId;
	var username = req.session.username;

	try {
		var results = await db_msg.getChatMessage(roomId);
		await db_msg.clearUnread();
	} catch (err) {
		console.log(err);
	}
	res.render("chatRoom", {
		user: username,
		curUserId: userId,
		messages: results,
		groupId: groupId,
	});
});

app.post("/chatGroups/:groupId/:messageId/submitEmoji", async (req, res) => {
	var groupId = req.params.groupId;
	var messageId = req.body.messageId;
	var userId = req.session.userId;
	var emojiId = req.body.emoji;
	var result = await db_emoji.sendEmoji({
		user_id: userId,
		emoji_id: emojiId,
		message_id: messageId,
	});
	console.log(result);
	res.redirect(`/chatGroups/${groupId}/`);
});
app.get("/chatGroups/:groupId/invite", async (req, res) => {
	var groupId = req.params.groupId;
	var groupUsers = await groups.getGroupUsers(groupId);
	var nonGroupUsers = await groups.getNonGroupUsers(
		groupUsers.map((user) => user.user_id)
	);

	res.render("invite", {
		groupId: groupId,
		currentMembers: groupUsers,
		nonMembers: nonGroupUsers,
		errMsg: false,
	});
});

app.post("/chatGroups/:groupId/invite/submitInvite", async (req, res) => {
	var username = req.session.username;
	var groupId = req.params.groupId;
	var newInvite = req.body.nonMembers;

	var groupUsers = await groups.getGroupUsers(groupId);
	// var groupUsers = results.map((user) => user.user_id);
	var nonGroupUsers = await groups.getNonGroupUsers(
		groupUsers.map((user) => user.user_id)
	);

	var missingFields = {};
	if (!newInvite) {
		missingFields.nonMembers = "Choose a user,";

		const errorMessage = Object.entries(missingFields)
			.map(([field, label]) => `${label} it is required`)
			.join(". ");

		res.render("invite", {
			groupId: groupId,
			currentMembers: groupUsers,
			nonMembers: nonGroupUsers,
			errMsg: errorMessage,
		});
		return;
	}

	var success = await groups.submitInvite({
		userId: newInvite,
		groupId: groupId,
	});
	if (success) {
		res.redirect(`/chatGroups/${groupId}/invite/`);
	} else {
		res.render("errorMessage", { error: "Failed to submit a new invite." });
	}
});

// app.use("/chatRoom", sessionValidation);
// app.get("/chatRoom/:roomId", async (req, res) => {
// 	var userId = req.session.userId;
// 	var roomId = req.params.roomId;
// 	var results = await db_msg.getChatMessage(roomId);
// 	res.render("chatRoom", { curUserId: userId, messages: results });
// });

app.get("/createGroup", async (req, res) => {
	var users = await db_users.getUsers();
	res.render("createGroup", { users: users, errMsg: false });
});
app.post("/submitGroup", async (req, res) => {
	var username = req.session.username;
	var users = await db_users.getUsers(); // passing throgh rendering
	var groupName = req.body.groupName;
	var userId = req.body.users;
	if (!groupName || !userId) {
		var missingFields = {};
		if (!groupName) {
			missingFields.groupName = "Group name";
		}
		if (!userId) {
			missingFields.users = "One User";
		}
		const errorMessage = Object.entries(missingFields)
			.map(([field, label]) => `${label} is required`)
			.join(". ");

		res.render("createGroup", { users: users, errMsg: errorMessage });
		return;
	}
	var newGroupId = await groups.submitGroup({
		groupName: groupName,
		userId: userId,
	});
	if (newGroupId) {
		res.redirect("/chatGroups");
	} else {
		res.render("errorMessage", { error: "Failed to create a new group." });
	}
});

app.get("/signout", (req, res) => {
	req.session.destroy();
	res.render("index", { authenticated: false });
});

function isValidSession(req) {
	if (req.session.authenticated) {
		return true;
	}
	return false;
}

function sessionValidation(req, res, next) {
	if (!isValidSession(req)) {
		req.session.destroy();
		res.redirect("/login");
		return;
	} else {
		next();
	}
}

app.use(express.static(__dirname + "/public"));

app.get("*", (req, res) => {
	res.status(404);
	res.render("404");
});

app.listen(port, () => {
	console.log("Node application listening on port " + port);
});
