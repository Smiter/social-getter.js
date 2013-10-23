/* dependencies done */

(function($){

    var defaults = {

    }

    $.fn.socialGetter = function(options){
    	if(this.length == 0) return this;
    	// create a namespace to be used throughout the plugin
		var social = {};
		// set a reference to our slider element
		var that = this;



		/**
		 =============================================================================
		 ************************* PRIVATE FUNCTIONS***********************************
		 =============================================================================
		*/


		/**
		 * Initializes namespace settings to be used throughout plugin
		*/
		var init = function(){
			social.settings = $.extend({}, defaults, options);
			sendRequest("https://api.twitter.com/1.1/search/tweets.json?q=%23freebandnames&since_id=24012619984051000&max_id=250126199840518145&result_type=mixed&count=4");
		}

		var sendRequest = function(url){
			var jqxhr = $.ajax({
				dataType: "json",
				type: "GET",
  				url: url,
			})
		    .done(function(data) {
		    	console.log( "success: data = " + data);
		    })
		    .fail(function(data) {
		    	console.log( "error: data = " + data);
		    })
		    .always(function(data) {
		    	console.log( "complete: data = " + data);
		    });
		}


		/**
		 =============================================================================
		 ************************* PUBLIC FUNCTIONS***********************************
		 =============================================================================
		*/

		that.testPublic = function(){
			console.log("public")
		};



		init();
		return this;
    }
    
})(jQuery); //end of outer closure