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
				wrapper:
					'<div id="holder">' +
						'<div class="nav_holder">' +
							'<ul class="collections-nav-ul" style="margin-left: -103px;">' +
								'<li class="clickable collections-nav collections-nav-home  active" data-href="{{user}}">' +
									'<i class="icon-home" style="position:relative;"></i>' +
									'<div class="collection-triangle"></div>' +
								'</li>' + 
								'<li class="clickable collections-nav collections-nav-fb " data-href="facebook/{{user}}">' +
									'<i class="foundicon-facebook"></i>' +
									'<div class="collection-triangle"></div>' +
								'</li>' +
								'<li class="clickable collections-nav collections-nav-tw " data-href="twitter/{{user}}">' +
									'<i class="foundicon-twitter"></i>' +
									'<div class="collection-triangle"></div>' +
								'</li>' +
								'<li class="clickable collections-nav collections-nav-in " data-href="instagram/{{user}}">' +
									'<i class="foundicon-instagram"></i>' +
									'<div class="collection-triangle"></div>' +
								'</li>' +
							'</ul>' +
						'</div>' +
						'<div id="posts_holder">' +
						'</div>' +
					'</div>',

					posts:
				 		'{{#each posts}}' +
							'<div class="post {{_id}}" style="width: {{../column_width}}px; left: 0px; top: 0px">' +
								'<div class="post-holder">' +
									'<div class="post-content">' +
										'<a href="{{link}}" target="_blank">' +
											'<div>' +
												  '<img src="{{image}}" />' +
											'</div>' + 
										'</a>' +
										'<div class="post-text">'+
										    '<div class="post-title">'+
								                '<p>'+
								                    '<a href="{{link}}" target="_blank">{{text}}'+
								                        
								                    '</a>'+
								                '</p>'+
								            '</div>'+
								            '<div class="post-timestamp">{{created_time}}' +
								                         
								            '</div>'+
										'</div>'+
									'</div>'+
									'<div class="post-share">'+						       
									'</div>'+
									'<div class="post-accaunt">'+
									        '<img src="{{avatar}}"> <a href="{{author_link}}" target="_blank"><b>{{author}}</b><br>{{#if author_nickname}}@{{author_nickname}}{{/if}}</a>'+
									'</div>'+
								'</div>'+
							'</div>' +
						'{{/each}}'
			}

			var result = compileTemplate(social.templates.wrapper, {user: social.settings.user})
			$(that).append(result);
			renderPosts(social.settings.user);
			menuClickHandlers();
		}


		var menuClickHandlers = function(){
			$(that).on("click", ".collections-nav-ul li", function(){
				$("#posts_holder").empty();
				renderPosts($(this).attr('data-href'));
			});
		}

		var renderPosts = function(url){

			sendRequest(social.settings.api_url + url, function(data){
					
				var result = compileTemplate(social.templates.posts, {posts: data, column_width: social.settings.column_width - social.settings.column_paddings_l_r})
				$("#posts_holder").append(result);

				var left_array = [];
				for(var i = 0; i < social.settings.columns; i ++){
					left_array[i] = i * (social.settings.column_width - social.settings.column_paddings_t_b);
				}

				var i = 0;
				function setPostPositions(){
					data.forEach(function(element, index, array){
						var curr_post = $("#posts_holder ." + array[index]._id);
						if(index-social.settings.columns >= 0){
							var html_prev_post = $("#posts_holder ." + array[index-social.settings.columns]._id);
							var top = html_prev_post.position().top +	html_prev_post.height() + social.settings.column_paddings_t_b;
							curr_post.css("top", top +"px");
						}
						curr_post.css("left", left_array[i]+"px");
						if(++i == left_array.length)
							i = 0;
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