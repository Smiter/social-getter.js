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
				hubname: $(that).attr('data-hubname'),
				columns: $(that).attr('data-columns'),
				expand: $(that).attr('data-expand'),
				width: $(that).width(),
				height: $(that).css('height'),
				column_paddings_l_r: 20,
				column_paddings_t_b: 20,
				api_url: 'http://localhost:3000/api/'
			}

			if($(that).width()<=320){
				social.settings.columns = 1;
			}

			social.settings["column_width"] = $(that).width() / social.settings.columns;

			social.templates = {
				wrapper:
					'<div id="holder">' +
						'<div class="nav_holder">' +
							'<div class="collections-sub" style="position: fixed;"></div>'+

							'<ul class="collections-nav-ul">' +
								'<li style="height: 37px;" class="clickable collections-nav collections-nav-home  active" data-href="{{hubname}}">' +
									'<i class="icon-home" style="position:relative;"></i>' +
								'</li>' + 
								'<li style="background: #3B5998;" class="clickable collections-nav collections-nav-facebook " data-social-name="facebook" data-href="{{hubname}}/facebook">' +
									'<i class="foundicon-facebook"></i>' +
								'</li>' +
								'<li style="background: #3B5998;height: 37px;" class="clickable collections-nav collections-nav-facebook-events " data-social-name="facebook-events" data-href="{{hubname}}/facebook-events">' +
									'<img style="width: 23px;" class="foundicon-events" src="http://files.itimarketing.mobi/social-hub-dev/html/Events_icon.png" />' +
								'</li>' +
								'<li style="background: #32C1F0;" class="clickable collections-nav collections-nav-twitter " data-social-name="twitter" data-href="{{hubname}}/twitter">' +
									'<i class="foundicon-twitter"></i>' +
								'</li>' +
								'<li style="background: #32C1F0;height: 37px;" class="clickable collections-nav collections-nav-twitter-posts " data-social-name="twitter-posts" data-href="{{hubname}}/twitter-posts">' +
									'<img style="width: 23px;" class="foundicon-events" src="http://files.itimarketing.mobi/social-hub-dev/html/Post_icon.png" />' +
								'</li>' +
								'<li style="background: #685c44;" class="clickable collections-nav collections-nav-instagram " data-social-name="instagram" data-href="{{hubname}}/instagram">' +
									'<i class="foundicon-instagram"></i>' +
								'</li>' +
								'<li style="background: #685c44;height: 37px;" class="clickable collections-nav collections-nav-youtube-posts " data-social-name="instagram-posts" data-href="{{hubname}}/instagram-posts">' +
									'<img style="width: 23px;" class="foundicon-events" src="http://files.itimarketing.mobi/social-hub-dev/html/Post_icon.png" />' +
								'</li>' +
								'<li style="background: red;" class="clickable collections-nav collections-nav-instagram " data-social-name="youtube" data-href="{{hubname}}/youtube">' +
									'<i class="foundicon-youtube"></i>' +
								'</li>' +
								'<li style="background: red;height: 37px;" class="clickable collections-nav collections-nav-youtube-posts " data-social-name="youtube-posts" data-href="{{hubname}}/youtube-posts">' +
									'<img style="width: 23px;" class="foundicon-events" src="http://files.itimarketing.mobi/social-hub-dev/html/Post_icon.png" />' +
								'</li>' +
								
							'</ul>' +
						'</div>' +
						'<div id="loading-holder">' +
						'<img src="http://d36hc0p18k1aoc.cloudfront.net/public/i/loading.gif" />'+
						'</div>' +
						'<div id="posts_holder">' +
						'</div>' +
					'</div>',

					posts:
				 		'{{#each posts}}' +
							'<div class="post {{_id}}" id="{{_id}}" data-pinned="{{pinned_time}}" data-visible="{{accepted}}" style="width: {{../column_width}}px; left: 0px; top: 0px">' +
								'<div class="post-holder">' +
									'<div class="post-content">' +
										'{{#unless image}}<div class="post-icon">' +
										    '{{#if author_nickname}}<i class="icon-twitter"></i>{{/if}}' + 
										    '{{#unless author_nickname}}<i class="icon-facebook"></i>{{/unless}}' +
										'</div>{{/unless}}' +
										'<a href="{{link}}" target="_blank">' +
											'<div>' +
												  '{{#if image}}<img src="{{image}}" />{{/if}}' +
											'</div>' + 
										'</a>' +
										'<div class="post-text">'+
										    '<div class="post-title">'+
								                '<p>'+
								                    '<a href="{{link}}" target="_blank">{{{text}}}'+
								                        
								                    '</a>'+
								                '</p>'+
								            '</div>'+
								            '<div class="post-timestamp">{{#get_created_time timestamp}}{{/get_created_time}}' +
								                         
								            '</div>'+
										'</div>'+
									'</div>'+
									'<div class="post-share">'+	
										'{{#unless author_nickname}}{{#unless comment}}<a class="comment-fb-a" href="{{link}}" target="_blank">' +
								            'Comment' + 
								        '</a>{{/unless}}{{/unless}}' + 
										'{{#if author_nickname}}<a class="comment-fb-a" href="https://twitter.com/intent/tweet?in_reply_to={{_id}}" target="_blank">' +
								            'Reply' + 
								        '</a>{{/if}}' + 	
										'{{#if comment}}<a class="comment-fb-a" href="{{comment}}" target="_blank">' +
								            'Comment' + 
								        '</a>{{/if}}' + 
								        '<a class="post-share-fb-a" href="http://www.facebook.com/sharer.php?u={{link}}" target="_blank">' +
								            '<i class="icon-hm-small icon-facebook"></i>' + 
								        '</a>' + 
								        '<a class="post-share-tw-a" href="https://twitter.com/intent/tweet?url={{link}}&text={{{text}}}">' + 
								        	'<i class="icon-hm-small icon-twitter"></i>' + 
								    	'</a>'+												       
									'</div>'+
									'<div class="post-accaunt">'+
									        '<img src="{{avatar}}"> <a href="{{author_link}}" target="_blank"><b>{{author}}</b><br>{{#if author_nickname}}@{{author_nickname}}{{/if}}</a>'+
									'</div>'+
								'</div>'+
							'</div>' +
						'{{/each}}',
					youtube:
				 		'{{#each posts}}' +
							'<div class="post {{_id}}" id="{{_id}}" data-pinned="{{pinned_time}}" data-visible="{{accepted}}" style="width: {{../column_width}}px; left: 0px; top: 0px">' +
								'<div class="post-holder">' +
									'<div class="post-content">' +
										'<a href="{{link}}" target="_blank">' +
											'<div>' +

												'<a href="{{link}}" target="_blank">' +
													'<div>' +
														  '<img src="{{image}}" />' +
													'</div>' + 
												'</a>' +
												    //'<iframe id="player" type="text/html" width="100%" height="250"'+
  													//	'src="https://www.youtube.com/embed/{{id}}"'+
  												    //'frameborder="0"></iframe>'+
											'</div>' + 
										'</a>' +
										'<div class="post-text">'+
										    '<div class="post-title">'+
								                '<p>'+
								                    '<a href="{{link}}" target="_blank">{{{text}}}'+
								                        
								                    '</a>'+
								                '</p>'+
								            '</div>'+
										'</div>'+
									'</div>'+
									'<div class="post-share">'+		
								        '<a class="post-share-fb-a" href="http://www.facebook.com/sharer.php?u={{link}}" target="_blank">' +
								            '<i class="icon-hm-small icon-facebook"></i>' + 
								        '</a>' + 
								        '<a class="post-share-tw-a" href="https://twitter.com/intent/tweet?url={{link}}&text={{{text}}}">' + 
								        	'<i class="icon-hm-small icon-twitter"></i>' + 
								    	'</a>'+												       
									'</div>'+
									'<div class="post-accaunt">'+
									        '<a style="top: -18px;left:0" href="https://www.youtube.com/user/{{author}}" target="_blank"><b>{{author}}</b></a>'+
									'</div>'+
								'</div>'+
							'</div>' +
						'{{/each}}',
					events:
				 		'{{#each posts}}' +
							'<div class="post {{_id}}" id="{{_id}}" data-pinned="{{pinned_time}}" data-visible="{{accepted}}" style="width: {{../column_width}}px; left: 0px; top: 0px">' +
								'<div class="post-holder">' +
									'<div class="post-content">' +
										'{{#unless image}}<div class="post-icon">' +
										    '<i class="icon-facebook"></i>' +
										'</div>{{/unless}}' +
										'<a href="https://www.facebook.com/events/{{_id}}" target="_blank">' +
											'<div>' +
												  '{{#if image}}<img src="{{image}}" />{{/if}}' +
											'</div>' + 
										'</a>' +
										'<div class="post-text">'+
										    '<div class="post-title event">'+
							                    '<a style="display: block" href="https://www.facebook.com/events/{{_id}}" target="_blank">'+
							                    	'<p class="name">{{name}}</p>' +
							                    	'<p class="time">{{#get_event_time start_time}}{{/get_event_time}} {{#if end_time}}- {{#get_event_time end_time}}{{/get_event_time}}{{/if}}</p>' +
							                    	'<p class="desc">{{description}}</p>' + 
							                    '</a>'+
								            '</div>'+
										'</div>'+
									'</div>'+
									'<div class="post-share">'+		
								        '<a class="post-share-fb-a" href="http://www.facebook.com/sharer.php?u=https://www.facebook.com/events/{{_id}}" target="_blank">' +
								            '<i class="icon-hm-small icon-facebook"></i>' + 
								        '</a>' + 
								        '<a class="post-share-tw-a" href="https://twitter.com/intent/tweet?url=https://www.facebook.com/events/{{_id}}&text={{{name}}}">' + 
								        	'<i class="icon-hm-small icon-twitter"></i>' + 
								    	'</a>'+												       
									'</div>'+
									'<div class="post-accaunt">'+
									        '<img src="{{avatar}}"> <a href="https://www.facebook.com/events/{{_id}}" target="_blank"><b>{{author}}</b><br>{{#if author_nickname}}@{{author_nickname}}{{/if}}</a>'+
									'</div>'+
								'</div>'+
							'</div>' +
						'{{/each}}',
					groups:
				 		'{{#each posts}}' +
							'<div class="post {{_id}}" id="{{_id}}" data-pinned="{{pinned_time}}" data-visible="{{accepted}}" style="width: {{../column_width}}px; left: 0px; top: 0px">' +
								'<div class="post-holder">' +
									'<div class="post-content">' +
										'<div class="post-icon">' +
										    '{{#if image}}<img src="http://files.itimarketing.mobi/social-hub-dev/html/icon_groups.png" />{{/if}}' +
										'</div>' +
										'<div class="post-text">'+
										    '<div class="post-title event">'+
							                    '<a style="display: block" href="https://www.facebook.com/{{_id}}" target="_blank">'+
							                    	'<p class="name">{{name}}</p>' +
							                    	'<p class="desc">{{description}}</p>' + 
							                    '</a>'+
								            '</div>'+
										'</div>'+
									'</div>'+
									'<div class="post-share">'+		
								        '<a class="post-share-fb-a" href="http://www.facebook.com/sharer.php?u=https://www.facebook.com/groups/{{_id}}" target="_blank">' +
								            '<i class="icon-hm-small icon-facebook"></i>' + 
								        '</a>' + 
								        '<a class="post-share-tw-a" href="https://twitter.com/intent/tweet?url=https://www.facebook.com/groups/{{_id}}&text={{{name}}}">' + 
								        	'<i class="icon-hm-small icon-twitter"></i>' + 
								    	'</a>'+												       
									'</div>'+
									'<div class="post-accaunt">'+
									        '<img src="{{avatar}}"> <a href="https://www.facebook.com/{{_id}}" target="_blank"><b>{{author}}</b><br>{{#if author_nickname}}@{{author_nickname}}{{/if}}</a>'+
									'</div>'+
								'</div>'+
							'</div>' +
						'{{/each}}'
			}
			var min_by_column = Array();
			for(var j = 0; j < social.settings.columns; j++){
				min_by_column.push(Number.MAX_VALUE);
			}
			social.min_by_column = min_by_column;
			var result = compileTemplate(social.templates.wrapper, {hubname: social.settings.hubname})
			$(that).append(result);
			renderPosts(social.settings.hubname, 0);
			menuClickHandlers();


			social.scrollHandler = addScrollHandler();

			

			sendRequest(social.settings.api_url + social.settings.hubname + '/hubs', function(data){
				var hubs = data;
				$( ".collections-nav-ul li" ).hover(
				  function() {
				  	var that = this;
				    var items = hubs[$(this).attr('data-social-name')];
				    console.log(typeof items);
				    if(items == undefined || typeof items == 'string' ){
				    	$('.collections-sub').css({'display': 'none'});
				    	return;
				    }
				    $('.collections-sub').css('background', $(this).css('background'))
				    $('.collections-sub').empty();
				    var list = '';
				    items.forEach(function(element, index, array){
				    	list += '<div class="collections-sub-item clickable" data-social-name="' +$(that).attr('data-social-name')+'" data-href="' + social.settings.hubname +'/' + $(that).attr('data-social-name') +  '?keyword='+ element+ '" data-network="twitter">'+ element +'</div>';
				    });
				    $('.collections-sub').append(list);
				    var pos_x = $(this).offset().left;
				    var pos_y = $(this).offset().top + 45;
				    $('.collections-sub').css({'display': 'block', 'left': pos_x +10- $('.collections-sub').width()/2, 'top': pos_y});
				  }, function() {
				  }
				);

				$(document.body).on('mouseover', '.post', function(){
					$('.collections-sub').css({'display': 'none'});
				})
			});
		}

		var weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


		Handlebars.registerHelper('get_created_time', function(timestamp, options) {
		  return getPostedTime(new Date().getTime(), timestamp);
		});

		Handlebars.registerHelper('get_event_time', function(time, options) {
			var d = new Date(time);
			return weekday[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate();
		});

		var menuClickHandlers = function(){
			$(that).on("click touchstart", ".collections-nav-ul li", function(event){
				event.preventDefault();
				$("#loading-holder").show();
				//$("#posts_holder").hide();
				$(".social-getter #posts_holder").css("visibility", 'hidden');
				$("#posts_holder").empty();
				social.scrollHandler.isHandlerOn = true;
				social.scrollHandler.scrollTop = $(window).scrollTop();
				social.scrollHandler.offset = 0;
				social.scrollHandler.url = $(this).attr('data-href'); 
				social.social_name = $(this).attr('data-social-name');
				renderPosts($(this).attr('data-href'), 0);

				$(".collections-nav-ul li").removeClass("active");
				$(this).addClass("active");
			});

			$(that).on("click touchstart", ".collections-sub-item", function(event){
				event.preventDefault();
				$("#loading-holder").show();
				//$("#posts_holder").hide();
				$(".social-getter #posts_holder").css("visibility", 'hidden');
				$("#posts_holder").empty();
				social.scrollHandler.isHandlerOn = true;
				social.scrollHandler.scrollTop = $(window).scrollTop();
				social.scrollHandler.offset = 0;
				social.scrollHandler.url = $(this).attr('data-href'); 
				social.social_name = $(this).attr('data-social-name');
				renderPosts($(this).attr('data-href'), 0);
			});
		}

		var addScrollHandler = function(){
			this.isHandlerOn = true;
			this.offset = 0;
			this.scrollTop = $(window).scrollTop();
			this.url = social.settings.hubname;
			var scrollElement = window;
			if(social.settings.expand == "false"){
				scrollElement = $("#posts_holder");
				$("#posts_holder").niceScroll({autohidemode:false, cursorwidth: 7});
			}	

			function getNewPosts(){
				isHandlerOn = false;
				offset = offset + 20;


				if(url.indexOf('?')>=0)
					var url_1 = '&offset=' + offset;
				else
					var url_1 = '?offset=' + offset;

				renderPosts(url + url_1, offset, function(){
					isHandlerOn = true;
					$("#posts_holder").getNiceScroll().resize();
				});
			}
			$(scrollElement).on('scroll', function(){
				var documentElementHeight = $(document).height();
				if(social.settings.expand == "false"){
					if(isHandlerOn && $("#ascrail2000 div").position().top + $("#ascrail2000 div").height()>=$("#ascrail2000").height()-100 && scrollTop < $(scrollElement).scrollTop()){
                 		getNewPosts();
                 	}
				}else{
					if(isHandlerOn && documentElementHeight - $(scrollElement).scrollTop() - 
						$(scrollElement).height() - 650 <= 0 && scrollTop < $(scrollElement).scrollTop()){
						getNewPosts();
					}
				}
				scrollTop = $(window).scrollTop();
			});
			return this;
		}

		var hideUnsupportedSocialMedia = function(data){
			if(data["not_avialable_social"] != undefined && data["not_avialable_social"].length > 0){
				data["not_avialable_social"].forEach(function(element, index, array){
					$(".collections-nav-"+element).hide();
				});
			}
		}

		var renderPosts = function(url, offset, callback){

			if($(".social-getter").hasClass("manager") == true && $(".tnt-btn.active").data('public-posts') == "0" ){
				if(url.indexOf('?')>=0)
					url += '&manager=true'
				else
					url += '?manager=true'
			}
			sendRequest(social.settings.api_url + url, function(data){

				hideUnsupportedSocialMedia(data);

				var item_template = social.templates.posts;
				if(social.social_name == "facebook-events"){
					item_template = social.templates.events;
				}
				if(social.social_name == "facebook-groups"){
					item_template = social.templates.groups;
				}
				if(social.social_name == "youtube" || social.social_name == "youtube-posts"){
					item_template = social.templates.youtube;
				}

				if($(".social-getter").hasClass("manager") == false){
					data['posts'] = data['posts'].filter(function(item){
						return item["accepted"] == undefined || item["accepted"] == 1;
					});
				}
				var result = compileTemplate(item_template, {posts: data['posts'], column_width: social.settings.column_width - social.settings.column_paddings_l_r})
				$("#posts_holder").append(result);

				var left_array = [];
				for(var i = 0; i < social.settings.columns; i ++){
					left_array[i] = i * (social.settings.column_width);
				}

				function setPostPositions(){
					$("#loading-holder").hide();
					var postElements = $("#posts_holder .post");
					data['posts'].forEach(function(element, index, array){
							var curr_post = $("#posts_holder ." + array[index]._id);
						if(index + offset - social.settings.columns >= 0){
							var min = findMin(social.min_by_column);
							var minIdx = findMinIdx(social.min_by_column);
							curr_post.css("top", min +  social.settings.column_paddings_t_b +"px");
							social.min_by_column[minIdx] = parseInt($(curr_post).css('top'), 10)  +	$(curr_post).height();
							curr_post.css("left", left_array[minIdx]+"px");
						}else{
							social.min_by_column[index] = parseInt($(curr_post).css('top'), 10)  +	$(curr_post).height();
							curr_post.css("left", left_array[index]+"px");
						}
						$(".social-getter #posts_holder").css("visibility", 'visible');
					});
					$.event.trigger({
						type: "socialGetterNewPostsLoaded",
					});
					// $(".post-share-fb-a").on('click', function(e){
					// 	e.preventDefault();
					// 	var id = $(this).parents('.post').attr('id');
					// 	var post = data['posts'].filter(function(item){
					// 		return item._id == id;
					// 	})[0];
						
					// 	FB.ui(
					// 	    {method: 'feed',  link: post.link,
					// 	    description: post.text,
					// 	    picture: post.image
					// 	    },
					// 	    function(response){
					// 	    }
					// 	);
					// });
					if(callback && typeof callback === 'function')
						callback();
				}

				function makeFirstLineUpperCase(){
					if(social.social_name != "facebook-events"){
						$(".social-getter #posts_holder").css("visibility", 'visible');
						var text_height = Number.MAX_VALUE;
						var text_entities = $(".social-getter #posts_holder .post-title a");
						for(var i = offset; i < text_entities.length; i ++){
							var entity = $(text_entities[i]);
							var curr_text = entity.text();
							var text_split = curr_text.split(" ");
							entity.empty();
							for(var j=0; j< text_split.length; j++){
								var txt_temp = entity.text();
								entity.text(txt_temp + " " + text_split[j]);
								if(text_height < entity.height()){
									entity.text(txt_temp);
									entity.append("<br/><span style='font-size: 15px'> " +  curr_text.replace(txt_temp.trim(),"")  +  "</span>");
									break;
								}
								text_height = entity.height();
							}
						}
					}
				}
				$("#posts_holder img").error(function(){
					this.height = 1;
					$(this).hide();
				});
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
								$(".social-getter #posts_holder").css("visibility", 'visible');
								makeFirstLineUpperCase();
								setPostPositions();
							});
						}else{
							callback();
						}
					}, 20);
				}

				checkIfImagesLoaded(function(){
					$(".social-getter #posts_holder").css("visibility", 'visible');
					makeFirstLineUpperCase();
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
		    	callback("fail");
		    })
		    .always(function(data) {
		    });
		}

		function findMin(arr){
			return Math.min.apply(Math, arr);
		}

		function findMinIdx(arr){
			return arr.indexOf(Math.min.apply(this,arr));
		}

		var months = Array('Jan','Feb','Mar','Apr','May', 'June','July','Aug','Sept','Oct','Nov','Dec');

		var getPostedTime = function (stamp1,stamp2) {
		    var date1 = new Date(stamp1);
		    var date2 = new Date(stamp2 * 1000);

		    if(date1.getYear() == date2.getYear()){
		    	if(date1.getMonth() == date2.getMonth() && date1.getDate() - date2.getDate() == 0){
		    		return date1.getHours() - date2.getHours() + " hours ago";
			    }
			    else if(date1.getMonth() == date2.getMonth() && date1.getDate() - date2.getDate() == 1){
			    	if(date1.getHours() + 23 - date2.getHours() > 24)
			    		return date2.getDate() + " " + months[date2.getMonth()];
			    	else
		    			return date1.getHours() + 23 - date2.getHours() - 1 + " hours ago";
			    }
			    else if(date1.getMonth() == date2.getMonth() && date1.getDate() - date2.getDate() == 0){
			    	if(date1.getHours() == date2.getHours()){
			    		return date1.getMinutes() - date2.getMinutes() + " minutes ago";
			    	}else{
			    		return date1.getHours() - date2.getHours() + " hours ago";
			    	}
			    }
			    else{
			    	return date2.getDate() + " " + months[date2.getMonth()];
			    }
		    }
		    else{
		    	return date2.getFullYear() + " " + date2.getDate() +" " + months[date2.getMonth()];
		    }
		};

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