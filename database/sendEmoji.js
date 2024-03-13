const database = include("databaseConnection");

async function sendEmoji(postData) {
	let sendEmojiSQL = `
        INSERT INTO message_emoji_user(message_id, user_id, emoji_id)
        VALUES(:message, :user, :emoji)
    `;
	let params = {
		user: postData.user_id,
		emoji: postData.emoji_id,
		message: postData.message_id,
	};

	try {
		await database.query(sendEmojiSQL, params);

		console.log("Successfully insert emoji");
	} catch (err) {
		console.log("Error inserting emoji");
		console.log(err);
		return false;
	}
}

module.exports = { sendEmoji };
