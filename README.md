# CreateStory

CreateStory is a web application that allows users to create, edit, and share interactive stories. Built with Node.js, Express, and MongoDB.

## Features

- User authentication and authorization
- Create and edit stories
- Public and private story settings
- Interactive story segments
- Modern UI with Tailwind CSS

## Tech Stack

- Node.js
- Express.js
- MongoDB
- EJS (Template Engine)
- Tailwind CSS
- Passport.js (Authentication)

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/CreateStory.git
cd CreateStory
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Development

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server

## License

MIT

## Author

[Your Name] 