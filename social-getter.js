/* dependencies done */

(function($){

    $.fn.socialGetter = function(){
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
			social.settings = {
				user: $(that).attr('data-user'),
				social_name: $(that).attr('data-social-name'),
				columns: $(that).attr('data-columns'),
				width: $(that).css('width'),
				height: $(that).css('height'),
				api_url: 'http://127.0.0.1:3000/api/'
			}
			social.settings["column_width"] = $(that).width() / social.settings.columns;

			social.templates = {
				post:
					'<div class="post {{posts._id}}" style="width: {{column_width}}px; left: {{left}}px; top: {{top}}px">'+
						  '<img src="{{posts.image}}" />'+
					'</div>'
			}
			sendRequest(social.settings.api_url + social.settings.social_name + "/" + social.settings.user, function(data){
				var result = '<div id="holder"><div id="posts_holder"></div></div>';
				$(that).append(result);
				var left = 0;
				var top = 0;
				var padding = 10;

				var left_array = [];
				for(var i = 0; i < social.settings.columns; i ++){
					left_array[i] = i * (social.settings.column_width - padding);
				}
				var i = 0;
				var l = left_array.length;
				data.forEach(function(element, index, array){
					if(index-social.settings.columns >= 0){
						top = $("#posts_holder ." + array[index-social.settings.columns]._id).position().top +
							$("#posts_holder ." + array[index-social.settings.columns]._id + " img").height() + padding;
					}
					left = left_array[i];
					i++;
					if(i == left_array.length)
						i = 0;
					
					var html = compileTemplate(social.templates.post, {posts: element, column_width: social.settings.column_width - 25, left: left, top: top});
					$("#posts_holder").append(html);
				});
			});
		}

		var compileTemplate = function(html, context){
			var source   = html;
			var template = Handlebars.compile(source);
			var html    = template(context);
			return html;
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

    var social = $(".social-getter").socialGetter();
    
})(jQuery); //end of outer closure