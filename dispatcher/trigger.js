function DispatchQueue(){
    return new Promise((resolve,reject)=>{
        return resolve({success:true});
    });
}

exports.DispatchQueue=DispatchQueue;