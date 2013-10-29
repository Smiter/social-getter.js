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
			sendRequest("http://127.0.0.1:3000/api/"+
				social.settings.social_name+"/"+social.settings.user, function(data){
					var list = "<ul>";
					data.forEach(function(element, index, array){
						list = list + "<li><img src=" + element.image + "/></li>";
					});
					list = list + "</ul>";
					$(that).append(list);
				});
		}

		var sendRequest = function(url, callback){
			var jqxhr = $.ajax({
  				url: url,
  				dataType:"json"
			})
		    .done(function(data) {
		    	callback(data);
		    })
		    .fail(function(data) {
		    	console.log("fail");
		    })
		    .always(function(data) {
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