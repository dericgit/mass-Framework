
$.define("avalon","data,attr,event,fx", function(){
    //knockout的缺陷
    //1看这里，许多BUG没有修https://github.com/SteveSanderson/knockout/issues?page=1&state=open
    //2里面大量使用闭包，有时多达七八层，性能感觉不会很好
    //3with的使用会与ecma262的严格模式冲突
    //4代码隐藏（指data-bind）大量入侵页面，与JS前几年提倡的无侵入运动相悖
    //5好像不能为同一元素同种事件绑定多个回调
    //人家花了那么多心思与时间做出来的东西,你以为是小学生写记叙文啊,一目了然....
    var validValueType = $.oneObject("Null,NaN,Undefined,Boolean,Number,String")
    $.dependencyChain = (function () {
        var _frames = [];
        return {
            begin: function (ret) {
                _frames.push(ret);
            },
            end: function () {
                _frames.pop();
            },
            collect: function (self) {
                if (_frames.length > 0) {
                    self.list = self.list || [];
                    var fn = _frames[_frames.length - 1];
                    if ( self.list.indexOf( fn ) >= 0)
                        return;
                    self.list.push(fn);
                }
            }
        //            pubblico : [],
        //            put: function(fn){
        //                this.pubblico.push(fn)
        //            }

        };
    })();

    $.computed = function(obj, scope){
        var args//构建一个至少拥有getter,scope属性的对象
        if(typeof obj == "function"){
            args = {
                getter: obj,
                scope: scope
            }
        }else if( typeof obj == "object" && obj && obj.getter){
            args = obj
        }
        return $.observable( args, true )
    }

    $.observable = function(old, isComputed){
        var cur, init = true
        function field( neo ){
            var set, scope = field.scope//判定是读方法还是写方法
            if(arguments.length){ //setter
                neo =  typeof field.setter === "function" ? field.setter.apply( scope, arguments ) : neo
                set = true;
            }else{  //getter
                if(typeof field.getter === "function"){
                    init && $.dependencyChain.begin( field );//只有computed才在依赖链中暴露自身
                    if("cache" in field){
                        neo = field.cache;//从缓存中读取,防止递归读取
                    }else{
                        neo = field.getter.call( scope );
                        field.cache = neo;//保存到缓存
                    }
                    init &&  $.dependencyChain.end()
                }else{
                    neo = cur
                }
                init && $.dependencyChain.collect( field )//将暴露到依赖链的computed放到自己的通知列表中
                // $.dependencyChain.put( field )
                init = false
            }
            if(cur !== neo ){
                cur = neo;
                $.avalon.notify( field );
            }
            return set ? field : cur
        }
        field.isObservable = true;
        field.toString = field.valueOf = function(){
            return field.cache;
        }
        if( isComputed == true){
            console.log(old.getter)
            for(var name  in old){
                field[ name ] = old[ name ]
            }
            field();//必须先执行一次
        }else{
            old = validValueType[ $.type(old) ] ? old : void 0;
            cur = old;//将上一次的传参保存到cur中,ret与它构成闭包
            field(old);//必须先执行一次
        }
        return field
    }

    //normalizeJSON及其辅助方法与变量
    void function(){
        var restoreCapturedTokensRegex = /\@mass_token_(\d+)\@/g;
        function restoreTokens(string, tokens) {
            var prevValue = null;
            while (string != prevValue) { // Keep restoring tokens until it no longer makes a difference (they may be nested)
                prevValue = string;
                string = string.replace(restoreCapturedTokensRegex, function (match, tokenIndex) {
                    return tokens[tokenIndex];
                });
            }
            return string;
        }
        function parseObjectLiteral(objectLiteralString) {
            var str = objectLiteralString.trim();
            if (str.length < 3)
                return [];
            if (str.charAt(0) === "{")// 去掉最开始{与最后的}
                str = str.substring(1, str.length - 1);
            // 首先用占位符把字段中的字符串与正则处理掉
            var tokens = [];
            var tokenStart = null, tokenEndChar;
            for (var position = 0; position < str.length; position++) {
                var c = str.charAt(position);//IE6字符串不支持[],开始一个个字符分析
                if (tokenStart === null) {
                    switch (c) {
                        case '"':
                        case "'":
                        case "/":
                            tokenStart = position;//索引
                            tokenEndChar = c;//值
                            break;
                    }//如果再次找到一个与tokenEndChar相同的字符,并且此字符前面不是转义符
                } else if ((c == tokenEndChar) && (str.charAt(position - 1) !== "\\")) {
                    var token = str.substring(tokenStart, position + 1);
                    tokens.push(token);
                    var replacement = "@mass_token_" + (tokens.length - 1) + "@";//对应的占位符
                    str = str.substring(0, tokenStart) + replacement + str.substring(position + 1);
                    position -= (token.length - replacement.length);
                    tokenStart = null;
                }
            }
            // 将{},[],()等括起来的部分全部用占位符代替
            tokenEndChar = tokenStart = null;
            var tokenDepth = 0, tokenStartChar = null;
            for (position = 0; position < str.length; position++) {
                var c = str.charAt(position);
                if (tokenStart === null) {
                    switch (c) {
                        case "{": tokenStart = position; tokenStartChar = c;
                            tokenEndChar = "}";
                            break;
                        case "(": tokenStart = position; tokenStartChar = c;
                            tokenEndChar = ")";
                            break;
                        case "[": tokenStart = position; tokenStartChar = c;
                            tokenEndChar = "]";
                            break;
                    }
                }
                if (c === tokenStartChar)
                    tokenDepth++;
                else if (c === tokenEndChar) {
                    tokenDepth--;
                    if (tokenDepth === 0) {
                        var token = str.substring(tokenStart, position + 1);
                        tokens.push(token);
                        replacement = "@mass_token_" + (tokens.length - 1) + "@";
                        str = str.substring(0, tokenStart) + replacement + str.substring(position + 1);
                        position -= (token.length - replacement.length);
                        tokenStart = null;
                    }
                }
            }
            //拆解字段，还原占位符的部分
            var result = [];
            var keyValuePairs = str.split(",");
            for (var i = 0, j = keyValuePairs.length; i < j; i++) {
                var pair = keyValuePairs[i];
                var colonPos = pair.indexOf(":");
                if ((colonPos > 0) && (colonPos < pair.length - 1)) {
                    var key = pair.substring(0, colonPos);
                    var value = pair.substring(colonPos + 1);
                    result.push({
                        'key': restoreTokens(key, tokens),
                        'value': restoreTokens(value, tokens)
                    });
                } else {//到这里应该抛错吧
                    result.push({
                        'unknown': restoreTokens(pair, tokens)
                    });
                }
            }
            return result;
        }
        function ensureQuoted(key) {
            var trimmedKey = key.trim()
            switch (trimmedKey.length && trimmedKey.charAt(0)) {
                case "'":
                case '"':
                    return key;
                default:
                    return "'" + trimmedKey + "'";
            }
        }
        // var e =  $.normalizeJSON("{aaa:111,bbb:{ccc:333, class:'xxx', eee:{ddd:444}}}");
        // console.log(e)
        $.normalizeJSON = function (json, insertFields, extra) {//对键名添加引号，以便安全通过编译
            var keyValueArray = parseObjectLiteral(json),resultStrings = [] ,keyValueEntry, propertyToHook = [];
            for (var i = 0; keyValueEntry = keyValueArray[i]; i++) {
                if (resultStrings.length > 0)
                    resultStrings.push(",");
                if (keyValueEntry['key']) {
                    var key = keyValueEntry['key'].trim();
                    var quotedKey = ensureQuoted(key), val = keyValueEntry['value'].trim();
                    resultStrings.push(quotedKey);
                    resultStrings.push(":");
                    if(insertFields === true && key === "foreach"){//特殊处理foreach
                        var array = val.match($.rword);
                        val = array.shift();
                        if(array[0] === "as"){//如果用户定义了多余参数
                            extra.$itemName = array[1]
                            extra.$indexName = array[2]
                        }
                    }
                    if(val.charAt(0) == "{" && val.charAt(val.length - 1) == "}"){
                        val = $.normalizeJSON( val );//逐层加引号
                    }
                    resultStrings.push(val);
                    if(insertFields == true){//用函数延迟值部分的执行
                        if (propertyToHook.length > 0)
                            propertyToHook.push(", ");
                        propertyToHook.push(quotedKey + " : function() { return " + val + " }")
                    }
                } else if (keyValueEntry['unknown']) {
                    resultStrings.push(keyValueEntry['unknown']);//基于跑到这里就是出错了
                }
            }
            resultStrings = resultStrings.join("");
            if(insertFields == true){
                resultStrings += ' , "@mass_fields": {'+ propertyToHook.join("") + '}'
            }
            return "{" +resultStrings +"}";
        }
    }();
    
    $.avalon = {
        //为一个Binding Target(节点)绑定Binding Source(viewModel)
        setBindings: function(source, node){
            node = node || document.body; //确保是绑定在元素节点上，没有指定默认是绑在body上
            //开始在其自身与孩子中绑定
            return setBindingsToElementAndChildren(node, source);
        },
        //取得节点的数据隐藏
        hasBindings: function(node){
            var str = node.getAttribute("data-bind");
            return typeof str === "string" && str.indexOf(":") > 1
        },
        //转换数据隐藏为一个函数;;;相当于ko的buildEvalWithinScopeFunction
        parse: function(expression, level){
            var body = "return (" + expression + ")";
            for (var i = 0; i < level; i++) {
                body = "with(sc[" + i + "]) { " + body + " } ";
            }
            return  Function("sc", body);
        },
        notify: function( field ){
            var list = field.list;
            if($.type(list,"Array") && list.length){
                var safelist = list.concat(), dispose = false
                for(var i = 0, el; el = safelist[i++];){
                    delete el.cache;//清除缓存
                    if(el.dispose === true || el() == true ){//通知顶层的computed更新自身
                        el.dispose = dispose = true
                    }
                }
                if( dispose == true ){//移除无意义的绑定
                    for (  i = list.length; el = list[ --i ]; ) {
                        if(el.dispose == true){
                            el.splice( i, 1 );
                        }
                    }
                }
            }
        }
    }
    //MVVM三大入口函数之一
    $.applyBindings = $.setBindings = $.avalon.setBindings;
    $.parseBindings = function(node, extra){
        var jsonstr = $.normalizeJSON( node.getAttribute("data-bind"), true, extra );
        $.log(jsonstr)
        var fn = $.avalon.parse( jsonstr, 3 );
        return fn;//返回一个对象
    }
    //有一些域的依赖在定义vireModel时已经确认了
    //而对元素的操作的$.computed则要在bindings中执行它们才知
    function associateDataAndUI(node, field,  viewModel, extra, key, getBindings){
        var adapter = $.bindingAdapter[key], args = arguments;
        function symptom(){//这是依赖链的末梢,通过process操作节点
            if(!node){
                return true;//解除绑定
            }
            if(typeof field !== "function"){
                $.log("每次都生成")
                var bindings = getBindings( );
                field = bindings["@mass_fields"][key];
                $.log(field+"")
            }
            //     var args = [ node, field, viewModel, extra ];
            if(!symptom.init){
                $.dependencyChain.collect( field );
                adapter.init && adapter.init.apply(adapter, args);
                symptom.init = 1;
            }
            adapter.update && adapter.update.apply(adapter, args);
        }
        window.symptom = $.computed(symptom);
    }

    //为当前元素把数据隐藏与视图模块绑定在一块
    function setBindingsToElement( node, viewModel, extra ){
        //如果bindings不存在，则通过getBindings获取，getBindings会调用parseBindingsString，变成对象
        extra = extra || {}
        var getBindingsFn = $.parseBindings( node, extra )//保存到闭包中
        var getBindings = function(){
            return getBindingsFn( [node, viewModel, extra] )
        }
        var bindings = getBindings();
        var continueBindings = true;
        for(var key in bindings){
            var adapter = $.bindingAdapter[key];
            if( adapter ){
                if( adapter.stopBindings ){
                    continueBindings = false;
                }
                $.log("associateDataAndUI : "+key)
                associateDataAndUI( node, bindings[key], viewModel, extra, key, getBindings)
            }
        }
        return continueBindings;
    }
    //在元素及其后代中将数据隐藏与viewModel关联在一起
    function setBindingsToElementAndChildren( node, source, extra ){
        if ( node.nodeType === 1  ){
            var continueBindings = true;
            if( $.avalon.hasBindings( node ) ){
                continueBindings = setBindingsToElement(node, source, extra ) //.shouldBindDescendants;
            }
            if( continueBindings ){
                var elems = getChildren(node)
                elems.length && setBindingsToChildren( elems, source, extra )
            }
        }
       
    }
    function setBindingsToChildren(elems, source, extra){
        $.log("setBindingsToChildren")
        for(var i = 0, n = elems.length; i < n ; i++){
            setBindingsToElementAndChildren( elems[i], source, extra )
        }
    }
  
    $.bindingAdapter = {
        text: {
            update:function ( node, field ) {
                var val = field();
                val = val == null ? "" : val+"";
                $(node).text(val)
            }
        },
        visible: {
            update:function( node, field ){
                var val = !!field();
                node.style.display = val ? "" : "none"
            }
        },
        enable: {
            'update': function (node, field) {
                var value = field()
                if (value && node.disabled)
                    node.removeAttribute("disabled");
                else if ((!value) && (!node.disabled))
                    node.disabled = true;
            }
        },
        html: {
            update: function( node, field ){
                var val = field();
                $(node).html( val )
            },
            stopBindings: true
        },
        "class":{
            update:function( node, field ){
                var val = field();
                if (typeof value == "object") {
                    for (var className in val) {
                        var shouldHaveClass = val[className];
                        toggleClass(node, className, shouldHaveClass);
                    }
                } else {
                    val = String(val || ''); // Make sure we don't try to store or set a non-string value
                    toggleClass(node, val, true);
                }
            }
        } ,
        // { text-decoration: someValue }
        // { color: currentProfit() < 0 ? 'red' : 'black' }
        style: {
            update:function(node, field){
                var val = field(), style = node.style, styleName
                for (var name in val) {
                    if (typeof style == "string") {
                        styleName = $.cssName(name, style) || name
                        node.style[styleName] = val[ name ] || "";
                    }
                }
            }
        },
        attr: {
            update:function(node, field){
                var val = field();
                for (var name in val) {
                    $.attr(node, name, val[ name ] )
                }
            }
        },
        prop: {
            update:function(node, field){
                var val = field();
                for (var name in val) {
                    $.prop(node, name, val[ name ] )
                }
            }
        },
        click: {
            init: function(node, field, viewModel){
                $(node).bind("click",function(e){
                    field.call( viewModel, e )
                });
            }
        },
        checked: {
            init: function(node, field){
                $(node).bind("change",function(){
                    field(node.checked);
                });
            },
            update:function(node, field){
                node.checked = !!field()
            }
        },
        foreach: {
            update:function(node, field, viewModel, more ){
                var val = field()
                var frag = node.ownerDocument.createDocumentFragment(),
                el;
                while(el = node.firstChild){
                    frag.appendChild(el)
                }
                var frags = [frag];//防止对fragment二次复制,引发safari的BUG
                for(var i = 0, n = val.length - 1 ; i < n ; i++){
                    frags[frags.length] = frag.cloneNode(true)
                }
                for(i = 0; frag = frags[i];i++){
                    var extra = {
                        $parent: viewModel,
                        $index: i,
                        $item: val[i]
                    }
                    if(more.$itemName){
                        extra[ more.$itemName ] = val[i]
                    }
                    if(more.$indexName){
                        extra[ more.$indexName ] = i
                    }
                    var elems = getChildren(frag)
                    node.appendChild(frag);
                    if(elems.length){
                        setBindingsToChildren(elems, val[i], extra)
                    }
                }
            },
            stopBindings: true
        }
    }
    $.bindingAdapter.disable = {
        update: function( node, field){
            $.bindingAdapter.enable(node, function(){
                return !field
            })
        }
    }
    var getChildren = function(node){
        var elems = [] ,ri = 0
        for (node = node.firstChild; node; node = node.nextSibling){
            if (node.nodeType === 1){
                elems[ri++] = node;
            }
        }
        return elems;
    }
    // var b
    $.bindingAdapter["css"] = $.bindingAdapter["css"]
    var toggleClass = function (node, className, shouldHaveClass) {
        var classes = (node.className || "").split(/\s+/);
        var hasClass = classes.indexOf( className) >= 0;//原className是否有这东西
        if (shouldHaveClass && !hasClass) {
            node.className += (classes[0] ? " " : "") + className;
        } else if (hasClass && !shouldHaveClass) {
            var newClassName = "";
            for (var i = 0; i < classes.length; i++)
                if (classes[i] != className)
                    newClassName += classes[i] + " ";
            node.className = newClassName.trim();
        }
    }

});

//http://tunein.yap.tv/javascript/2012/06/11/javascript-frameworks-and-data-binding/

   