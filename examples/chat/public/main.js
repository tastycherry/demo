$(function() {
  var FADE_TIME = 150; // 毫秒
  var TYPING_TIMER_LENGTH = 400; // 毫秒
  var COLORS = [
    'black', 'grey', 'green', 'blue',
    'yellow', 'pink', 'yellow', 'brown',
    'orange', 'chocolate', 'midnightblue', 'lavender'
  ];

  //初始化
  var $window = $(window);
  var $usernameInput = $('.usernameInput');
  var $messages = $('.messages');
  var $inputMessage = $('.inputMessage');

  var $loginPage = $('.login.page');
  var $chatPage = $('.chat.page');

  // 建立用户名
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "目前有1位参与者";
    } else {
      message += "目前有 " + data.numUsers + " 位参与者";
    }
    log(message);
  }

  // 把输入转换为用户名(trim去掉前后空格)
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // 用户名正确 切换页面
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // 用户名提交至服务器
      socket.emit('add user', username);
    }
  }

  // 发送聊天信息
  function sendMessage () {
    var message = $inputMessage.val();
    // 防止混入html标签
    message = cleanInput(message);
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // 告诉服务器
      socket.emit('new message', message);
    }
  }


  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // 看不懂!
  function addChatMessage (data, options) {
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // 添加正在输入
  function addChatTyping (data) {
    data.typing = true;
    data.message = '正在输入';
    addChatMessage(data);
  }

  //移除正在输入
  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // 添加消息并且保持页面在底部??
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
    var $el = $(el);

    // 我也不是很懂...求指导
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // 应用选项
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  //确保输入不包含html标签之类的东西
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // 更新正在输入事件 查看是否正在输入
  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // 获得是否正在输入的消息
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // 用户名的颜色 使用哈希函数
  function getUsernameColor (username) {
    // 哈希函数代码
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // 计算颜色
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // 键盘行为

  $window.keydown(function (event) {
    // 键盘按下自动聚焦
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // 按下回车键
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // 鼠标点击行为

  // 鼠标点击时聚焦输入框
  $loginPage.click(function () {
    $currentInput.focus();
  });


  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  // 登录信息
  socket.on('login', function (data) {
    connected = true;

    var message = "使用socket.io制作 ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // 有新信息更新
  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  // 用户加入
  socket.on('user joined', function (data) {
    log(data.username + ' 加入了');
    addParticipantsMessage(data);
  });

  // 用户离开
  socket.on('user left', function (data) {
    log(data.username + ' 离开了');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // 正在输入
  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  // 删除输入信息
  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });
});
