const logInstance = require('log-to-file');
const fs = require('fs');
const defaultLog = './logs/' + new Date().toDateString() + '/';

const log = async (message, logfile) => {

    try{
        fs.mkdirSync(defaultLog);
    }
    catch(error){}

    if (logfile){
        await logInstance(message,defaultLog + logfile + '.log');
    }
    else{
        await logInstance(message,defaultLog + 'console.log');
    }
    console.log(message);
};

const getLogTemplate = ()=>{
    return defaultLog;
};

module.exports = {
  log,
    getLogTemplate
};