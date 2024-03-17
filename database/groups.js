const database = include("databaseConnection");
//given specific user, return groupid, groupname, last message time, #of unread message
async function viewChatGroups(postData) {
	// given a userId, get group list and last message
	let getGroupList = `
		SELECT r.room_id, r.name, MAX(m.sent_datetime) AS last_message_time
		FROM room AS r
		JOIN room_user AS ru ON r.room_id = ru.room_id
		LEFT JOIN message AS m ON ru.room_user_id = m.room_user_id
		WHERE ru.user_id = :user_id
		GROUP BY r.room_id, r.name
	`;

	// given a userId, get the count of unread messages
	let getUnreadMsgCount = `

		SELECT 
			ru.room_id AS room_id, user_id,
			SUM(CASE 
				WHEN message.message_id <= (user_rooms.last_read_message_id) THEN 0 
				ELSE 1
			END) AS num_unread_messages

		FROM 
			message
			JOIN room_user AS ru USING (room_user_id)
			JOIN (
				SELECT DISTINCT room_id, last_read_message_id
				FROM room_user
				WHERE user_id = :user_id
			) AS user_rooms ON user_rooms.room_id = ru.room_id  
		GROUP BY ru.room_id ;

	`;

	let params = {
		user_id: postData,
	};

	try {
		const groupListResults = await database.query(getGroupList, params);
		// console.log(groupListResults[0]);
		console.log("Successfully retrieved group list");
		const unreadMsgCountResults = await database.query(
			getUnreadMsgCount,
			params
		);
		// console.log(unreadMsgCountResults[0]);
		console.log("Successfully retrieved unread messages");

		const combinedResults = {
			groupList: groupListResults[0],
			unreadMsgCount: unreadMsgCountResults[0],
		};
		console.log(combinedResults);
		return combinedResults;
	} catch (err) {
		console.log("Error getting the groups of the user");
		console.log(err);
		return false;
	}
}

// Given (group)room_id, get all the users in the group
async function getGroupUsers(group_id) {
	let groupusers = `
		SELECT user_id, username
		FROM user
		JOIN room_user USING (user_id)
		WHERE room_id = :group_id
	`;
	let params = { group_id: group_id };
	try {
		results = await database.query(groupusers, params);
		console.log("Successfully retrieved the users in the group");
		console.log(results[0]);
		return results[0];
	} catch (err) {
		console.log("Error getting the the users in the group");
		console.log(err);
		return false;
	}
}

// Given (group)room_id, get all the non group users in the group
async function getNonGroupUsers(groupUsers) {
	let nonGroupusers = `
		SELECT user_id, username
		FROM user AS u
		WHERE user_id NOT IN (:groupUsers);
	
	`;
	let params = { groupUsers: groupUsers };
	try {
		results = await database.query(nonGroupusers, params);
		console.log("Successfully retrieved the non group users in the group");
		console.log(results[0]);
		return results[0];
	} catch (err) {
		console.log("Error getting the non group users in the group");
		console.log(err);
		return false;
	}
}

async function submitGroup(postData) {
	let params = {
		groupName: postData.groupName,
		userId: postData.userId,
	};

	//Create a new group
	let createGroupSQL = `
		INSERT INTO room(name) VALUES(:groupName);

	`;
	try {
		const results = await database.query(createGroupSQL, params);
		console.log("Successfully create a group");
	} catch (err) {
		console.log("Error creating a group");
		console.log(err);
		return false;
	}
	// retrieve the created group id
	let getGroupId = `
		SELECT room_id FROM room
		WHERE name = :groupName
	`;
	try {
		const results = await database.query(getGroupId, params);
		console.log("Successfully retrieve the created group id");
		console.log(results[0]);
		var newGroupId = results[0][0].room_id;
	} catch (err) {
		console.log("Error retrieving the created group id");
		console.log(err);
		return false;
	}

	let submitGroup = `
		INSERT INTO room_user(user_id, room_id, last_read_message_id)
		VALUES
	`;
	if (Array.isArray(postData.userIds)) {
		postData.userIds.forEach((userId, index) => {
			submitGroup += `( ${userId}, :newGroupId, 1),`;
		});
	} else {
		// Treat postData.userIds as a single value
		submitGroup += `( ${postData.userIds}, :newGroupId, 1),`;
	}
	// Remove the trailing comma
	submitGroup = submitGroup.slice(0, -1);

	let param2 = {
		// userId: postData.userId,
		newGroupId: newGroupId,
	};

	try {
		const results = await database.query(submitGroup, param2);
		console.log("Successfully submit the users into the group");
		return true;
	} catch (err) {
		console.log("Error submitting the users into the group");
		console.log(err);
		return false;
	}
}

async function submitInvite(postData) {
	let submitInviteSQL = `
	INSERT INTO room_user(user_id, room_id)
	VALUES(:user_id, :room_id)
	`;
	let params = {
		user_id: postData.userId,
		room_id: postData.groupId,
	};

	try {
		results = await database.query(submitInviteSQL, params);
		console.log("Successfully adding users into the group");
		return true;
	} catch (err) {
		console.log("Error adding users into the group");
		console.log(err);
		return false;
	}
}

module.exports = {
	viewChatGroups,
	getGroupUsers,
	getNonGroupUsers,
	submitGroup,
	submitInvite,
};
