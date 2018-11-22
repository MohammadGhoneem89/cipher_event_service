function DispatchQueue(test){
    return new Promise((resolve,reject)=>{
        console.log(`trigger ${test}`);
        return resolve({success:true});
    });
}

exports.DispatchQueue=DispatchQueue;