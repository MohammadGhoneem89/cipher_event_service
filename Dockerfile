FROM node:6.9.5

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
#COPY package.json .


# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
#COPY package.json.
# For npm@5 or later, copy package-lock.json as well
# COPY package.json package-lock.json .



# Bundle app source
COPY . .

#EXPOSE 9000
CMD [ "node", "MQListener.js"]

