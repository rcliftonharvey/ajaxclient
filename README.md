# AJAX Client
#### Asynchronous AJAX Client in pure JavaScript

-------------------------------------------------------------------------------------------------------

## Index

1. [Introduction](./README.md#introduction)
2. [How to use](./README.md#how-to-use)
3. [Browser compatibility](./README.md#browser-compatibility)
4. [Example project](./README.md#example-project)
5. [License](./README.md#license)
6. [Credits](./README.md#credits)

-------------------------------------------------------------------------------------------------------

## Introduction

This implementation only focuses on **asynchronous transmission**, meaning *the page and other scripts continue to load and execute while the AJAX request runs in the background* and fires various events or user-assigned functions on status changes like success or failure. Instead of directly receiving output from the *.get()* or *.post()* methods, **callback functions** need to be assigned to handle success and failure or various other cases.

> Information on why using synchronous transfer *(page pauses loading until AJAX call completes)* is usually not a good idea: https://xhr.spec.whatwg.org/#synchronous-flag

If you want to see what's going on under the hood, have a look into the source of [rchajax.js](./library/rchajax.js), it's thoroughly commented with explanations and examples.

For productive use in a live environment, include the [rchajax.min.js](./library/rchajax.min.js) file in your HTML page to get started.

The AJAX Client was written in pure JavaScript without any dependencies. This means it will play well with third-party JS libraries such as jQuery, but the AJAX Client does **not** require any of them. You can just include this JavaScript into your HTML file and get going.

The original repository for this AJAX Client is right here:<br>
[https://github.com/rcliftonharvey/ajaxclient]

-------------------------------------------------------------------------------------------------------

## How to use

Unless you wish to waste bandwidth on the un-compressed and commented source for debugging, just put the minified [rchajax.min.js](./library/rchajax.min.js) script file somewhere on your web space and include it into the **head** section of your HTML page like this. Make sure you get that **src** path right...
```html
<head>
    <title>My web site</title>
    <script src="rchajax.min.js"></script>
</head>
```

Once the main script is included, you can start creating AJAX Clients anywhere on your page.

>You could theoretically re-use a single instance for multiple requests, just make sure that you don't re-initialize the second request before the first request has finished. To be absolutely certain this doesn't happen, it is recommended to use one instance of the AJAX Client per request. 

To create an instance of the AJAX Client, write this somewhere inside a JavaScript code block:
```javascript
var ajax = new AJAX.Client();
```
The variable **ajax** is now a container for the AJAX Client, which means it's time to tell it what to do.

Since the AJAX Client is **asynchronous**, meaning *the page continues to load and execute while the AJAX Client fetches stuff in the background*, you can't just grab a return value from a request method. Instead, the AJAX Client uses **event handlers**. The way this works is pretty simple: you write your own functions that should be executed in various situations, then you let the AJAX Client know in which situation to fire which function. That's all there's to it.
```javascript
// You could define a namd global function like this...
function fnSuccess (successEvent) // <-- Make sure the function expects an argument
{
    // You can access the retrieved data like so:
    var data = successEvent.target.responseText;   // successEvent = name of function argument
    
    // Do something with the loaded data 
    console.log(data);
}

// .. and then assign the function you just defined (without parentheses)
// to the AJAX Client's event handler for the on.success event. 
ajax.on.success = fnSuccess;

// Alternatively, you could avoid creating a global function, and just
// create a function directly "into" the event handler's event function.
ajax.on.error = function ()
{
    console.log('There was an error!');
};

```

When the AJAX Client performs its request successfully, it will trigger the **ajax.on.success( )** function. Should it encounter an error along the way, the **ajax.on.error()** function is fired.

Apart from *success* and *error*, the AJAX Client class can handle all these events:
* connect
* request
* response
* receive
* success
* failure
* abort
* timeout
* error
* complete
* status

> For more specific instructions about these events, i.e. when and under which circumstances they are fired, please check the comments in the [rchajax.js](./library/rchajax.js) source.

Now that the client is instantiated and knows what to do in case of success or error, it's time to actually let it fetch something.
```javascript
// Perform a GET request without any URL parameters
ajax.get('url-to-file');

// Perform a GET request with URL parameters
var user = 'rob';
ajax.get('url-to-resource?name=' + user + '&action=payrise');

// Perform a POST request without any parameters
ajax.post('url-to-file');

// Perform a POST request with parameters
var action = 'pat';
var area = 'shoulder';
ajax.post('url-to-resource?do=' + action + '&on=' + area);
```
>**Note** that for easier usability, *POST* parameters are passed into the AJAX Client via the URL argument of the *.post()* method. The AJAX Client will dissect the URL string by itself and turn URL parameters into valid POST request variables, without sending readable URL parameters to the remote.

When a *.get()* or *.post()* request is called through the AJAX Client, it will try to locate and retrieve the resource, and it will fire any events that have event handlers assigned along the way, like the *ajax.on.success()* and *ajax.on.error()* a few examples up.

> The AJAX Client doesn't encrypt or decrypt anything you send or receive through it, nor does it check for or take action against malicious code. You will have to implement your own measures to ensure your application runs safely.

-------------------------------------------------------------------------------------------------------

## Browser compatibility

I'll level with you - I don't know. It works in the versions of Firefox, Safari and Chrome that I have around. The AJAX Client uses ECMA5 *strict mode*, which is explicitly supported from Internet Explorer 10 at least. But I made sure to only use IE-safe code, and I tried to *shim* what I couldn't rely on older versions of IE to provide, so **theoretically** it should also work just fine in IE9 and even IE8. *I will furthet test compatibility at some point and update this section.*

-------------------------------------------------------------------------------------------------------

## Example project

To see how the AJAX Client can be used, I've included a very basic example page in the [demo](./demo/) folder of this repository.

All it does is wait for you to click a button, then load an external file and place its content into an element on the document body, so it's not very intricate or complex. But it should do a pretty good job at explaining how to use this AJAX Client.

> Most browsers will either not like satisfying an AJAX request to a local file, or they will complain about a potential cross-site scripting attempt. I would recommend that you host the demo files on a web space behind an HTTP server, just to be sure this doesn't happen.

-------------------------------------------------------------------------------------------------------

## License

This source code is provided under the [MIT License](./LICENSE).<br>
A copy of the MIT license in written form comes in the download of this library.

-------------------------------------------------------------------------------------------------------

## Credits

The compressed [rchajax.min.js](./library/rchajax.min.js) file was minified using Andrew Chilton's [JavaScript Minifier](https://javascript-minifier.com/).

-------------------------------------------------------------------------------------------------------

Enjoy!

Rob Clifton-Harvey

