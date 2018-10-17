const config = global.config;;
const DAL = require("../DAL");
const logger = require('../logger');

const pendingDispatchRequestQry = `select * from eventdispatchqueue where status=0`;
const insertDispatchRequestQry = `INSERT INTO eventdispatchqueue(sourceevent, eventdata, dispatcher, datasource, status, createdon)
VALUES ($1::varchar, $2::json, $3::json, $4::json, 0, clock_timestamp())`;

const updateDispatchRequestQry = `update eventdispatchqueue set status=$2::int, updatedon=clock_timestamp(), error = $3::text where internalid=$1::bigint`;




function getPendingDispatchRequest() {
  let refKey = 0
  return DAL.executeDataSet(pendingDispatchRequestQry, [], 'Meta Information', refKey).then((data) => {
    console.log('Pending Dispatch Requests Fetched ');
    let resp = data.rows;
    return resp;
  });
}

function updateDispatchRequest(internalID,status,error) {

  let refKey = internalID + "____DISPATCH"
  return DAL.executrScalar(updateDispatchRequestQry, [internalID,status,error], null, refKey).then(() => {
    console.log('DISPATCH Status Updated!!! ' + refKey);
  });

}


function insertDispatchRequest(param) {
  param.forEach(data => {
    let refKey = data.sourceEvent + "____DISPATCH"
    return DAL.executrScalar(insertDispatchRequestQry, [data.sourceEvent, data.eventData, data.dispatcher, data.datasource], null, refKey).then(() => {
      console.log('DISPATCH Request created!!! ' + refKey);
    });
  });
}

exports.getPendingDispatchRequest = getPendingDispatchRequest
exports.insertDispatchRequest = insertDispatchRequest
exports.updateDispatchRequest = updateDispatchRequest
