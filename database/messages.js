const database = include("databaseConnection");
//given specific group id, return the messages(separate read and unread)
async function getChatMessage(postData) {
	let getChatMessageSQL = `
	SELECT 
    message.*,
    CASE 
        WHEN message.message_id <= ru.last_read_message_id THEN 'read' 
        ELSE 'unread' 
    END AS message_status,
    user.username, user.user_id FROM message
	JOIN room_user as ru USING (room_user_id)
	JOIN user USING (user_id)
	WHERE room_id = 1
	ORDER BY sent_datetime ASC;
    `;
	let params = { room_id: postData };

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
		results = await database.query(getRoomUserIdSQL, params);
		console.log("Successfully geting the room_user_id");
		var room_user_id = results[0];
	} catch (err) {
		console.log(err);
		console.log("Fail submitting the room_user_id");
		return false;
	}

	//insert new message into table messages
	let submitMessageSQL = `
		INSERT INTO messages(room_user_id, sent_datetime, text)
		VALUES(:room_user_id, :sent_time, text: text)
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
}

async function clearUnread(postData) {
	let clearUnreadSQL = `
        UPDATE room_user
        SET last_read_message_id = (
            SELECT MAX(message_id)
            FROM message
        );  
    `;

	try {
		results = await database.query(clearUnreadSQL);
		console.log("Successfully clear the unread messages");
		return results[0];
	} catch (err) {
		console.log(err);
		console.log("Fail clearing the unread messages");
	}
}

module.exports = { getChatMessage, clearUnread, submitMessage };
