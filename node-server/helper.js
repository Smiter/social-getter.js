var months = Array('Jan','Feb','Mar','Apr','May', 'June','July','Aug','Sept','Oct','Nov','Dec');

module.exports.getPostedTime = function (stamp1,stamp2) {
    var date1 = new Date(stamp1);
    var date2 = new Date(stamp2 * 1000);

    if(date1.getYear() == date2.getYear()){
    	if(date1.getDate() - date2.getDate() == 1){
    		return date1.getHours() + 24 - date2.getHours() + " hours ago";
	    }
	    else if(date1.getDate() - date2.getDate() == 0){
	    	if(date1.getHours() == date2.getHours()){
	    		return date1.getMinutes() - date2.getMinutes() + " minutes ago";
	    	}else{
	    		return date1.getHours() - date2.getHours() + " hours ago";
	    	}
	    }
	    else{
	    	return date2.getDate() +" " + months[date2.getMonth()];
	    }
    }
    else{
    	return date2.getFullYear() + " " + date2.getDate() +" " + months[date2.getMonth()];
    }
};



