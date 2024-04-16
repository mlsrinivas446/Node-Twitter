const jwt = require('jsonwebtoken')
const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const nodemon = require('nodemon')
const app = express()
app.use(express.json())

let db = null

let loginUsername = ''

const dbPath = path.join(__dirname, 'twitterClone.db')

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000')
    })
  } catch (error) {
    console.log(`DB ERROR: ${error.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

// API - 1

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const hasedPassword = await bcrypt.hash(password, 10)
  const checkUserIsRegisterOrNotQuery = `SELECT * FROM user WHERE username='${username}'`
  const checkUserIsRegisterOrNot = await db.get(checkUserIsRegisterOrNotQuery)
  if (checkUserIsRegisterOrNot === undefined) {
    if (password.length < 6) {
      return response.status(400).send('Password is too short')
    } else {
      const userRegisterQuery = `INSERT INTO user(name,username,password,gender) VALUES ('${name}','${username}','${hasedPassword}','${gender}');`
      const userRegistered = await db.run(userRegisterQuery)
      const lastId = userRegistered.lastID
      return response.status(200).send('User created successfully')
    }
  } else {
    return response.status(400).send('User already exists')
  }
})

//  API 2

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  loginUsername = username

  const checkUserIsRegisteredForLoginQuery = `SELECT * FROM user  WHERE username='${username}'; password='${password}';`
  const checkUserIsRegisteredForLogin = await db.get(
    checkUserIsRegisteredForLoginQuery,
  )
  if (checkUserIsRegisteredForLogin !== undefined) {
    const passwordCheck = await bcrypt.compare(
      password,
      checkUserIsRegisteredForLogin.password,
    )
    if (passwordCheck) {
      const payload = {username: username, password: password}
      const jwtToken = jwt.sign(payload, 'mySecret')
      response.send({jwtToken: jwtToken})
    } else {
      return response.status(400).send('Invalid password')
    }
  } else {
    return response.status(400).send('Invalid user')
  }
})

const Authentication = async (request, response, next) => {
  const authHeader = request.headers['authorization']
  if (!authHeader) {
    return response.status(401).send('Invalid JWT Token')
  }
  const jwtToken = authHeader.split(' ')[1]
  if (jwtToken === undefined) {
    return response.status(401).send('Invalid JWT Token')
  }
  jwt.verify(jwtToken, 'mySecret', (err, decoded) => {
    if (err) {
      return response.status(401).send('Invalid JWT Token')
    }
    next()
  })
}

const UserRequest = async (request, response, next) => {
  const {tweetId} = request.params
  const isRequestOrNot = `SELECT * FROM tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id WHERE tweet.tweet_id='${tweetId}';`
  const checkRequestOrNot = await db.get(isRequestOrNot)
  if (checkRequestOrNot === undefined) {
    return response.status(401).send('Invalid Request')
  } else {
    next()
  }
}

const DeleteRequest = async (request, response, next) => {
  const {tweetId} = request.params
  const isRequestOrNot = `SELECT * FROM tweet INNER JOIN user ON tweet.user_id = user.user_id WHERE tweet.tweet_id='${tweetId}';`
  const checkRequestOrNot = await db.get(isRequestOrNot)
  if (checkRequestOrNot === undefined) {
    return response.status(401).send('Invalid Request')
  } else {
    next()
  }
}

// API 3

app.get('/user/tweets/feed/', Authentication, async (request, response) => {
  const latestTweetsQuery = `SELECT username,tweet,date_time AS dateTime FROM user NATURAL JOIN tweet ORDER BY date_time DESC LIMIT 4 OFFSET 1;`
  const latestTweets = await db.all(latestTweetsQuery)
  response.send(latestTweets)
})

// API 4
app.get('/user/following/', Authentication, async (request, response) => {
  const followerOfModiQuery = `SELECT name FROM user INNER JOIN follower ON user.user_id = follower.following_user_id WHERE follower_user_id = (
    SELECT user_id FROM user
    WHERE username = '${loginUsername}'
  );`
  const followerOfModi = await db.all(followerOfModiQuery)
  response.send(followerOfModi)
})

// API 5

app.get('/user/followers/', Authentication, async (request, response) => {
  const followerOfModiQuery = `SELECT name FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id WHERE following_user_id = (
    SELECT user_id FROM user
    WHERE username = '${loginUsername}'
  );`
  const followerOfModi = await db.all(followerOfModiQuery)
  response.send(followerOfModi)
})

// API 6

app.get(
  '/tweets/:tweetId/',
  Authentication,
  UserRequest,
  async (request, response) => {
    const {tweetId} = request.params
    const followerOfModiQuery = `SELECT tweet,count(like_id) AS likes,count(reply_id) AS replies, date_time AS dateTime FROM ((tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id) AS tweetFollower INNER JOIN reply ON tweetFollower.tweet_id = reply.tweet_id) AS tweetFollowerReply INNER JOIN like ON tweetFollowerReply.tweet_id = like.tweet_id   WHERE tweet.tweet_id='${tweetId}';`
    const followerOfModi = await db.get(followerOfModiQuery)
    response.send(followerOfModi)
  },
)

// API 7

app.get(
  '/tweets/:tweetId/likes/',
  Authentication,
  UserRequest,
  async (request, response) => {
    const {tweetId} = request.params
    const followerOfModiQuery = `SELECT name  FROM (tweet INNER JOIN follower on tweet.user_id = follower.following_user_id) AS t INNER JOIN user ON t.tweet_id=user.user_id WHERE tweet.tweet_id=${tweetId};`
    const followerOfModi = await db.all(followerOfModiQuery)

    response.send(followerOfModi)
  },
)

// API 8

app.get(
  '/tweets/:tweetId/replies/',
  Authentication,
  UserRequest,
  async (request, response) => {
    const {tweetId} = request.params
    const followerOfModiQuery = `SELECT name,reply FROM (user INNER JOIN follower on user.user_id = follower.following_user_id) AS t INNER JOIN reply ON t.user_id=reply.reply_id WHERE reply.tweet_id=${tweetId};`
    const followerOfModi = await db.all(followerOfModiQuery)

    response.send(followerOfModi)
  },
)

// API 9

app.get('/user/tweets/', Authentication, async (request, response) => {
  const followerOfModiQuery = `SELECT  tweet.tweet, COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies, tweet.date_time AS dateTime
    FROM tweet
    LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
    INNER JOIN user ON tweet.user_id = user.user_id
    WHERE user.user_id = (SELECT user_id FROM user WHERE user.username='${loginUsername}')
    GROUP BY tweet.tweet_id;`
  const followerOfModi = await db.all(followerOfModiQuery)
  response.send(followerOfModi)
})

// API 10

app.post('/user/tweets/', Authentication, async (request, response) => {
  const {tweet} = request.body
  const followerOfModiQuery = `INSERT INTO tweet(tweet) VALUES ('${tweet}');`
  await db.run(followerOfModiQuery)
  response.send('Created a Tweet')
})

// API 11

app.delete(
  '/tweets/:tweetId/',
  Authentication,
  DeleteRequest,
  async (request, response) => {
    const {tweetId} = request.params
    const followerOfModiQuery = `DELETE FROM tweet WHERE tweet_id='${tweetId}' AND user_id = (
    SELECT user_id FROM user
    WHERE username = '${loginUsername}'
  )`
    await db.get(followerOfModiQuery)
    response.send('Tweet Removed')
  },
)

module.exports = app
