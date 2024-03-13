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

module.exports = { getChatMessage, clearUnread };
