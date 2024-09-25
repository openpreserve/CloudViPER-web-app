FROM node:22-alpine3.19

# Set the working directory
WORKDIR /usr/src/app

COPY ./src/ ./

# Install dependencies
RUN npm install

# Expose the port
EXPOSE 3000

# Start the application
CMD [ "node", "app.js" ]