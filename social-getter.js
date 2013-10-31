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
				column_paddings_l_r: 40,
				column_paddings_t_b: 20,
				api_url: 'http://127.0.0.1:3000/api/'
			}
			social.settings["column_width"] = $(that).width() / social.settings.columns;

			social.templates = {
				post:
					'<div class="post {{post._id}}" style="width: {{column_width}}px; left: 0px; top: 0px">' +
						'<div class="post-holder">' +
							'<div class="post-content">' +
								'<a href="{{post.link}}" target="_blank">' +
									'<div>' +
										  '<img src="{{post.image}}" />' +
									'</div>' + 
								'</a>' +
								'<div class="post-text">'+
								    '<div class="post-title">'+
						                '<p>'+
						                    '<a href="{{post.link}}" target="_blank">{{post.text}}'+
						                        
						                    '</a>'+
						                '</p>'+
						            '</div>'+
						            '<div class="post-timestamp">{{post.created_time}}' +
						                         
						            '</div>'+
								'</div>'+
							'</div>'+
							'<div class="post-share">'+						       
							'</div>'+
							'<div class="post-accaunt">'+
							        '<img src="{{post.avatar}}"> <a href="{{post.author_link}}" target="_blank"><b>{{post.author}}</b><br>{{#if post.author_nickname}}@{{post.author_nickname}}{{/if}}</a>'+
							'</div>'+
						'</div>'+
					'</div>'
			}
			sendRequest(social.settings.api_url + social.settings.social_name + "/" + social.settings.user, function(data){
				var result = '<div id="holder"><div id="posts_holder"></div></div>';
				$(that).append(result);
				var left = 0;
				var top = 0;

				var left_array = [];
				for(var i = 0; i < social.settings.columns; i ++){
					left_array[i] = i * (social.settings.column_width - social.settings.column_paddings_t_b);
				}
				var i = 0;
				var l = left_array.length;
				var result = "";
				data.forEach(function(element, index, array){
					result = result + compileTemplate(social.templates.post, {post: element, column_width: social.settings.column_width - social.settings.column_paddings_l_r});
				});
				$("#posts_holder").append(result);

				function setPostPositions(){
					data.forEach(function(element, index, array){
						if(index-social.settings.columns >= 0){
							top = $("#posts_holder ." + array[index-social.settings.columns]._id).position().top +
								$("#posts_holder ." + array[index-social.settings.columns]._id).height() + social.settings.column_paddings_t_b;
							$("#posts_holder ." + array[index]._id).css("top", top +"px");
						}
						left = left_array[i];
						i++;
						if(i == left_array.length)
							i = 0;
						$("#posts_holder ." + array[index]._id).css("left", left+"px");
					});
				}
				function checkIfImagesLoaded(callback){
					setTimeout(function(){
						var isHeightZero = true;
						$.each( $("#posts_holder img"), function( index, value ){
							if (value.height == 0){
								isHeightZero = false;
								return;
							}
						});
						if(!isHeightZero){
							checkIfImagesLoaded(function(){
								setPostPositions();
							});
						}else{
							callback();
						}
					}, 20);
				}

				checkIfImagesLoaded(function(){
					setPostPositions();
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