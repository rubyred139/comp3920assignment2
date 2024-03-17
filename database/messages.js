const database = include("databaseConnection");
//given specific group id, return the messages(separate read and unread)
async function getChatMessage(postData) {
	let getChatMessageSQL = `
	SELECT 
    message.*,
    CASE 
        WHEN message.message_id <= (SELECT last_read_message_id FROM room_user WHERE user_id = :user_id AND room_id = :room_id) THEN 'read' 
        ELSE 'unread' 
    END AS message_status,
    user.username, user.user_id FROM message
	JOIN room_user as ru USING (room_user_id)
	JOIN user USING (user_id)
	WHERE room_id = :room_id 
	ORDER BY sent_datetime ASC;
    `;
	let params = { room_id: postData.room_id, user_id: postData.user_id };

	try {
		results = await database.query(getChatMessageSQL, params);
		console.log(results[0]);
		console.log("Successfully get chat messages");
		return results[0];
	} catch (err) {
		console.log(err);
		console.log("Fail getting chat messages");
	}
}

async function submitMessage(postData) {
	//get room_user_id
	let getRoomUserIdSQL = `
		SELECT * FROM room_user
		WHERE room_id = :room_id AND user_id = :user_id
	`;
	let param_rui = {
		room_id: postData.room_id,
		user_id: postData.user_id,
	};

	try {
		results = await database.query(getRoomUserIdSQL, param_rui);
		console.log("Successfully geting the room_user_id");
		console.log(results[0]);
		var room_user_id = results[0][0].room_user_id;
	} catch (err) {
		console.log(err);
		console.log("Fail getting the room_user_id");
		return false;
	}

	//insert new message into table messages
	let submitMessageSQL = `
		INSERT INTO message(room_user_id, sent_datetime, text)
		VALUES(:room_user_id, :sentTime, :text);
	`;

	let params = {
		room_user_id: room_user_id,
		sentTime: postData.sentTime,
		text: postData.text,
	};

	try {
		results = await database.query(submitMessageSQL, params);
		console.log("Successfully geting the chat messages");
	} catch (err) {
		console.log(err);
		console.log("Fail submitting chat messages");
		return false;
	}

	//update the last_read_message
	try {
		results = await database.query(clearUnreadSQL, param);
		console.log("Successfully clear the unread messages");
		return results[0];
	} catch (err) {
		console.log(err);
		console.log("Fail clearing the unread messages");
	}
}

async function clearUnread(postData) {
	let clearUnreadSQL = `
        UPDATE room_user
        SET last_read_message_id = (
            SELECT MAX(message_id)
            FROM message
        )
		WHERE user_id = :user_id AND room_id = :room_id;  
    `;

	let param = { user_id: postData.user_id, room_id: postData.room_id };

	try {
		results = await database.query(clearUnreadSQL, param);
		console.log("Successfully clear the unread messages");
		return results[0];
	} catch (err) {
		console.log(err);
		console.log("Fail clearing the unread messages");
	}
}

async function getEmojis(postData) {
	let getEmojiSQL = `
		SELECT room_user.room_id, message.message_id, emoji_id, emoji_name, COUNT(*) AS count
		FROM message
		JOIN (SELECT message_id, user.username AS user_name, emoji.emoji_id, emoji.name AS emoji_name
				FROM message_emoji_user
				JOIN emoji ON emoji.emoji_id = message_emoji_user.emoji_id
				JOIN user ON user.user_id = message_emoji_user.user_id

			) AS message_emoji_user_name ON message_emoji_user_name.message_id = message.message_id
		JOIN room_user ON room_user.room_user_id = message.room_user_id
		GROUP BY message.message_id, emoji_id, emoji_name
		HAVING room_id = :room_id

    `;

	let param = { room_id: postData };

	try {
		results = await database.query(getEmojiSQL, param);
		console.log("Successfully retrieving emoji data");
		return results[0];
	} catch (err) {
		console.log(err);
		console.log("Fail retrieving emoji data");
	}
}

module.exports = { getChatMessage, clearUnread, submitMessage, getEmojis };
