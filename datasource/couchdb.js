
const feed = () => {
    let sum = {DocumentName:"Transactions","ISATHR":true,"ISRECV":true};
      process.send(sum);
   
};


process.once('message', (config) => {
    global.config=config;
    feed();
});