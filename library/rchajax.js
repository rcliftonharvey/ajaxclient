// Asynchronous AJAX Client
//
// Copyright © 2018 Rob Clifton-Harvey
//
// Original repository
// https://github.com/rcliftonharvey/ajaxclient/
//
// Released under the MIT License
// https://github.com/rcliftonharvey/ajaxclient/tree/master/LICENSE
//
// This implementation only focuses on asynchronous transmission, meaning the page and other scripts continue to load and execute while
// the AJAX request runs in the background. The AJAX client fires various events or user-assigned functions on status changes like success
// or failure. Instead of directly receiving output from the .get() or .post() methods, callback functions need to be assigned to handle
// success and failure or various other cases.
//
// Information on why using synchronous transfer (=page pauses loading until AJAX call completes) is usually not a good idea:
// https://xhr.spec.whatwg.org/#synchronous-flag

// STRICT MODE
//
// The functions and methods in this implementation use strict mode to force the browser into compiling this script in ECMA 5 strict mode.
// Strict mode will basically enforce a better and "safer" programming style by complaining more in case of errors.
// It will point out obvious errors, like accidentally initializing global variables by mistyping a variable name or
// attempting to write to non-writable properties. Added benefit: it allows the browser to better optimize the code.
//
// More information about strict mode can be found here:
// https://developer.mozilla.org/docs/Web/JavaScript/Reference/Strict_mode

// INTERNET EXPLORER COMPATIBILITY HACKS
//
// What can I say. IE is an outdated and underfeatured piece of $#!+. Here we have to let IE understand what a 'class' is. OOP much?
// Yes, Internet Explorer 11 that comes with Windows 10 still doesn't know what a 'class' is. In Edge, they're an experimental feature.
// These are all things the IE devs could/should have implemented in 2013 (latest), since other browser's dev teams managed it, too.
//
// I have to thank the glorious Babel for so easily converting contemporary code into antiquated parchment mode that IE can understand.
// https://babeljs.io/repl
if (Object.values === undefined)
{
	/* Makes sure the browser knows what to do when calling .values() on an Object... */
    Object.defineProperties(Object.prototype,
        {
            'values':
            {
	            enumerable: false,
                value: function (object)
                {
	                'use strict';
	                
                    var values = [];

                    for (var val in object)
                    {
                        if (object.hasOwnProperty(val))
                        {
                            values.push(object[val]);
                        }
                    }

                    return values;
                }
            }
        }
    );
}

var _createClass = function ()
{
	'use strict';
	
    function defineProperties (Target, Properties)
    {
        for (var property=0; property<Properties.length; ++property)
        {
            var descriptor = Properties[property];

            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;

            if ('value' in descriptor)
            {
                descriptor.writable = true;
            }

            Object.defineProperty(Target, descriptor.key, descriptor);
        }
    }

    return function (Constructor, ProtoProps, StaticProps)
    {
        if (ProtoProps) {defineProperties(Constructor.prototype, ProtoProps);}
        if (StaticProps) {defineProperties(Constructor, StaticProps);}

        return Constructor;
    };
}();

var _typeof = function ()
{
	'use strict';
	
	if (typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol')
	{
	    return function (Obj) {return typeof Obj;};
	}
	else
	{
	    return function (Obj)
	    {
	        return (Obj && (typeof Symbol === 'function') && (Obj.constructor === Symbol) && (Obj !== Symbol.prototype)) ?
	            'symbol' :
	            (typeof Obj);
	    };
	}
}();

function _classCallCheck (Instance, Constructor)
{
	'use strict';
	
    if (!(Instance instanceof Constructor))
    {
        throw new TypeError('Cannot call a class as a function, use "new" to create instance.');
    }
}

// AJAX NAMESPACE
//
// This puts all the constants, variables and functionality required for the AJAX Client into a separate namespace in
// order to avoid potential conflicts with existing code. Anything in here can be accessed by prefixing it with: AJAX.
// AJAX.QUIET, AJAX.HTTP, AJAX.Log(), AJAX.Client(), etc.
var AJAX = {

    // DEBUG / CONSTRUCTOR FLAGS
    //
    // Pass these into the AJAX.Client() constructor or AJAX.Client.debug() to affect the behaviour of the client, if so desired.
    // 
    // Debugging follows a <= (less than or equal to) paradigm. If a log message is of a type that is less than or equal to the
    // current value of the socket debug setting, then it will be written to the browser's JS console. If a log message is of a
    // type of larger value than the current socket debug setting, then it will not be written to the browser's JS console.
    //
    // Without passing any flags into the constructor, default behaviour will be AJAX.WARNING = prints only errors and warnings.
    //
    // var ajax = new AJAX.Client();			/* Instantiates a Client with default .socket.debug value == .DEBUG == 16. */
    // AJAX.Log(AJAX.INFO,ajax,'Hello');		/* .INFO == 8, .DEBUG == 16, 8 <= 16, so this message WILL be written to console. */
    // ajax.debug(AJAX.WARNING);				/* Updates the Client "ajax" to only output messages of .WARNING or lower. */
    // AJAX.Log(AJAX.INFO,ajax,'Hello again');	/* .INFO == 8, .WARNING == 2, 8 > 2, so this message will NOT be written to console. */
    // AJAX.Log(AJAX.WARNING,ajax,'Coffee!!');  /* .WARNING == 2, .WARNING == 2, 2 <= 2, so this message WILL be written to console. */
    QUIET: 		 0, // No debug output in browser console
    ERROR: 		 1, // Logs a message that is marked as a critical error to the console.
    WARNING: 	 2,	// Logs a message that is marked as a warning to the console.
    LOG: 		 4, // Logs a regular and unmarked message to the console.
    INFO: 		 8, // Logs a message that is marked as information to the console.
    DEBUG: 		16, // Post ERROR, WARNING, LOG, INFO messages in browser console

    // CLIENT SOCKET STATUS FLAGS
    //
    // These are partly evaluated from the XMLHttpRequest.requestState, but they are NOT the same.
    // Consider these a somewhat more elaborate version.
    //
    // The current Client socket status can be polled from outside with .status().
    // To automate polling and have values pushed to the outside, assign a callback function to Client.on.status().
    STATUS: {
        INIT: 		-1, // before creation
        READY: 		 0, // after creation, idle, before .open()
        CONNECTED: 	 1, // after .open()
        REQUESTING:  2, // after .send(), onloadstart
        RESPONSE: 	 3, // after onloadstart, readyState 2
        RECEIVING: 	 4, // onprogress
        SUCCESS: 	 5, // onload
        FAILURE: 	 6, // onload
        ABORTED: 	 7, // onabort
        TIMEOUT: 	 8, // ontimeout
        ERROR: 		 9  // onerror, onreadystatechange eval error
    }, // end AJAX.STATUS

    // SOCKET TRANSMISSION STATES
    //
    // These are the real XMLHttpRequest.requestState values, used inside the state handler and listed here as debugging reference.
    //
    // See here for in-depth description:
    // https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/readyState
    TRANSFER: {
        0: 'Unsent',
        1: 'Opened',
        2: 'Headers received',
        3: 'Loading',
        4: 'Done'
    }, // end AJAX.TRANSFER

    // TRIM WHITESPACES
    //
    // Removes whitespaces from beginning and end of passed string argument.
    // If a non-string argument is passed into the function, it will be returned un-altered.
    //
    // Not all browsers (most notably IE < v10) support .trim() in strict mode, that's why this script shims it.
    // More information here: http://caniuse.com/#search=trim
    Trim: function Trim (Argument)
    {
	    'use strict';
	    
        // Create a default return value by copying the passed argument
        var result = Argument;

        // Only proceed if the passed argument is of type String
        if (typeof result === 'string' || result instanceof String)
        {
            // Set the return value to be the passed string argument with leading & trailing whitespaces removed
            result = result.replace(/^\s+|\s+$/g, '');
        }

        // return whatever is left at this point
        return result;
    }, // end AJAX.Trim ()

    // CONSOLE LOGGING
    //
    // Unified and simplified console logging function. This is called all over the place.
    // Takes one or more of the following arguments in any order:
    //
    // -- string	The actual message to log.
    // -- object	Pass "this" into Log() and it'll extract the client's name and debug status from it.
    // -- bool		Override debug setting with bool argument, can be used when the Client object is inaccessible or when a message should be forced out.
    // -- number	Integer with Message Type: AJAX.[LOG,INFO,WARNING,ERROR]
    // -- array		If variables or values need to be logged, pass them in a container array, even single values.
    // 
    // var ajax = new AJAX.Client('MyNewClient', AJAX.DEBUG);
    // AJAX.Log (AJAX.INFO, ajax, 'Client created', [ajax.name()] );
    Log: function Log ()
    {
	    'use strict';
	    
        // A bunch of working copy variables, some will be manipulated and evaluated later without affecting their origins.
        var message = '';       // Message body to print to log, initializes as empty string.
        var source = false;     // If a source Client object ('this') was passed as an argument, this is where it goes. Defaults to FALSE, meaning no source Client passed.
        var type = false;       // Message type: AJAX.[LOG,INFO,WARNING,ERROR]
        var elements = false;   // If an array with a variable or value was passed as an argument, this is where it goes.
        var debugging = null;   // Debug mode override. If a bool value is passed as an argument, it's stored here and override's the source client's .debug() setting.
        var sourcename = '';    // If a source Client object was passed as an argument, it's name will be extracted into here later. If none passed, stays empty tring.
		
        // Cycle through all passed arguments
        for (var argument=0; argument<arguments.length; ++argument)
        {
            // Convenience variable for the current argument
            var arg = arguments[argument];

            // Check if this argument is a number and therefore a message type
            if (typeof arg === 'number' || arg instanceof Number)
            {
                // Make sure we're dealing with an integer value
                type = parseInt(arg);
            }
            // Check if this argument is of type String and therefore the message text
            else if (typeof arg === 'string' || arg instanceof String)
            {
	            // Fetch the first character of the passed string argument
	            var firstChar = arg.substr(0,1);
	            
	            // Preserve one whitespace: if the first character was NOT a whitespace, don't put a whitespace back in the final message string
	            firstChar = (firstChar == ' ' ? ' ' : '');
	            
	            // Piece together message body with or without whitespace at beginning
                message = firstChar + AJAX.Trim(arg);
            }
            // Check if this argument is of type Object
            // Since arrays are also objects, this will be fired for both the 'real' Client object as well as the variable value arrays
            else if ((typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'object' || arg instanceof Object)
            {
                // Find out if this argument is of type Array and therefore the list of variable values to debug
                if (typeof arg === 'array' || arg instanceof Array)
                {
                    // push to elements-to-debug container
                    elements = arg;
                }
                // If not, it's probably a real object and the Client ('this') that called the Log().
                else
                {
                    // push to source container
                    source = arg;
                }
            }
            // Check if the argument is of type bool and therefore manual debug() override
            else if (typeof arg === 'boolean' || arg instanceof Boolean)
            {
                // flag manual debugging override
                debugging = arg;
            }
        }

        // If no message type flag was passed
        if (type === false)
        {
            // Assume messsage type to be default type: AJAX.LOG
            type = AJAX.LOG;
        }

        // Only if a 'real' source Client was specified
        if (source !== false)
        {
            // Extract its name
            sourcename = source.socket.options.clientname;

            // If the debugging state was NOT manually overridden
            if (debugging === null)
            {
                // Set debugging to true if the passed msg type is <= the current debug level
                debugging = (type <= source.socket.options.debug);
            }
        }

        // If the finally reached debugging state says to output the message
        if (debugging === true)
        {
            // Create a dummy container that will later represent the logging function to use
            var consoleCommand;

            // Check which message type we're dealing with
            switch (type)
            {
                // Assign the appropriate JS logging function to the dummy container
                case AJAX.LOG:
                    consoleCommand = console.log; // Logs a regular and unmarked message to the console.
                    break;

                case AJAX.INFO:
                    consoleCommand = console.info; // Logs a message that is marked as information to the console.
                    break;

                case AJAX.WARNING:
                    consoleCommand = console.warn; // Logs a message that is marked as a warning to the console.
                    break;

                case AJAX.ERROR:
                    consoleCommand = console.error; // Logs a message that is marked as a critical error to the console.
                    break;

                // If an invalid message type flag was passed
                default:
                    // Use AJAX.LOG / console.log() as default logging method
                    consoleCommand = console.log;
                    break;
            }

            // If there was no array with variable(s) passed into the function
            if (elements === false)
            {
                // Call the JS logging function the dummy container now refers to without passing a 2nd argument into it.
                consoleCommand(sourcename + message);
            }
            // If there was an array with variable(s) passed into the function
            else
            {
                // Call the JS logging function the dummy container now refers to and pass the variable into it as 2nd argument.
                consoleCommand(sourcename + message, (elements.length === 1 ? elements[0] : elements));
            }
        }
    }, // end AJAX.Log ()

    // AJAX CLIENT
    //
    // The heart of this all.
    //
    // Call this without arguments for default settings.
    //
    // var ajax = new AJAX.Client();				/* instantiates with debug==false, async==true and name=='AJAX.Client' (default) */
    //
    // Optionally call with one ore more of these arguments in any order:
    // -- string: 	sets the name for this instance, see .name() for more information.
    // -- number:	control .debug() settings with constructor flags
    //
    // var ajax = new AJAX.Client();				/* instantiates with debug==false, async==true, name=='AJAX.Client' (default) */
    // var ajax = new AJAX.Client(AJAX.DEBUG);		/* instantiates with debug==true,  async==true, name=='AJAX.Client' (default) */
    // var ajax = new AJAX.Client('jax');			/* instantiates with debug==false, async==true, name=='jax' */
    //
    // Values can later be changed or temporarily overridden.
    // See .name() or .debug() methods for more information.
    Client: function ()
    {
	    'use strict';
	    
        // In a world where Internet Explorer understands the JavaScript "class" keyword, this would be the constructor function of the class.
        function Client ()
        {
            _classCallCheck(this, Client);

            // SELF AWARENESS
            //
            // Save a reference to this Client instance in a variable, so it can be accessed from 'deeper down' later (where 'this' would refer to something else).
            var client = this;
            
            // SOCKET
            //
            // The actual ajax connection, this is what "transfers" the requests. Best to just leave this alone.
            // Hallelujah that MSIE 7+ can actually deal with this natively and without the ActiveX check/workaround.
            // Since this script requires IE to be of version 8 or higher anyway, there's no use in implementing the ActiveX method. Keeps things simple.
            this.socket = new XMLHttpRequest();

            // SOCKET OPTIONS default settings
            //
            // Leave these alone and use the constructor or the .name() and .debug() methods to set the socket up from the outside instead.
            this.socket.options = {
                clientname: 'AJAX.Client',
                debug: AJAX.WARNING
            };

            // STATUS FLAGS
            //
            // Internal flags used by the Client to store temporary states. Don't touch. ("...never ever steal, unless you're in for the kill.")
            this.socket.flags = {
                // SOCKET CONNECTION STATUS
                //
                // This is used to report the internal status to the outside through the Client.status() method and the Client.on.status() callback.
                //
                // Its value will be overwritten at various stages of the process, it's not read or used for decisions anywhere.
                // So changing it from the outside will do nothing. Use Client.status() to retrieve the current status from outside, or assign a function
                // to the Client.on.status() callback to receive notifications about status changes automatically.
                status: AJAX.STATUS.INIT,

                // ERROR STATUS
                //
                // Internal flag that is set whenever an error occurs during a request, simply to stop console flooding and superfluous evaluation steps.
                // Is reset whenever Client.get() or Client.post() are called, may be changed while they run. No need to access this from the outside,
                // just assign functions to the various Client.on.error(), Client.on.failure() etc. callbacks to be notified of problems automatically.
                error: false
            };

            // SOCKET LISTENERS
            //
            // A "listener storage" for this Client's socket. This is only an assignment stash "for internal use", it's nothing you should do anything with.
            // The listeners will trigger the appropriate Client.on. callbacks, it's intended and preferable to use callbacks to handle user specific functions.
            this.socket.listeners = {
                abort: false, 		/* request was aborted */
                error: false, 		/* failure due to an error */
                load: false, 		/* request completed successfully */
                loadend: false, 	/* request completed (error or success) */
                loadstart: false,	/* request initiates */
                progress: false, 	/* periodically updated while transmitting data */
                timeout: false 		/* stores the socket.ontimeout listener */
            };

            // CALLBACKS
            //
            // Callback functions that are run at various stages after a request is kicked off.
            // 
            // If assigned a function, listeners or the state handler will call the assigned function when appropriate and pass the current Event in as an argument.
            // If left at FALSE, they will be ignored and nothing happens when that event occurs.
            //
            // Use these to get the 'latest news' pushed from the Client to the outside. They need to be set BEFORE Client.get() or Client.post() are called.
            //
            // var ajax = new AJAX.Client();
            // ajax.on.success = function (result) {alert(result.responseText);};
            // ajax.get('http://etc');
            this.on = { 			/* in sequential order, triggered when... */
                connect: false, 	/* ... socket.open() was called */
                request: false, 	/* ... socket.send() was called */
                response: false, 	/* ... a header response was received, after socket.send() */
                receive: false, 	/* ... data after the header response is being continuously received, 'download in progress' */
                success: false, 	/* ... request ended without errors */
                failure: false, 	/* ... request ended because of error(s) */
                abort: false,		/* ... request ended because abort was called */
                timeout: false, 	/* ... request ended because took longer than defined in socket.timeout */
                error: false, 		/* ... onreadystatechange evaluation error or (to be determined) when listeners.error() called */
                complete: false,	/* ... the socket is finished handling the request, triggered always and no matter what the result was */
                status: false		/* ... the Client.socket.flags.status value is changed by Client.socket.setStatusFlag */
            };

            // SOCKET STATUS FLAG UPDATE
            //
            // Updates the Client's socket status flag and triggers a Client.on.status() event.
            // Don't do anything with this, it's only intended for internal use.
            this.socket.setStatusFlag = function (statusFlag)
            {
                // Output log message if debugging
                AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Status > setStatusFlag() > Called', [statusFlag], (client.socket.options.debug >= AJAX.INFO));

                // Make sure the new statusFlag is in a valid range
                if (statusFlag >= AJAX.STATUS.INIT && statusFlag <= AJAX.STATUS.ERROR)
                {
                    // Update socket status flag value
                    client.socket.flags.status = statusFlag;

                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Status > Triggering on.status()', [statusFlag], (client.socket.options.debug >= AJAX.INFO));

                    // If the user assigned a function to the .on.status event
                    if (client.on.status !== false)
                    {
                        // Fire the user-assigned .on.status function
                        client.on.status(client);
                    }
                    // If no used-specified function assigned to the on.status event
                    else
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, client, '.on.status() > undefined');
                    }
                }
                // Handle case that statusFlag is not in valid range
                else
                {
                    // Output log message if debugging
                    AJAX.Log(AJAX.WARNING, client, '.on.status() > flag not in valid range', statusFlag);
                }
            };

            // CONSTRUCTOR ARGUMENTS (Client settings)
            //
            // Cycle through all passed constructor arguments and flags
            for (var argument=0; argument<arguments.length; ++argument)
            {
                // Make convenience variable for the current argument
                var arg = arguments[argument];

                // Check if this argument is a number number and therefore a debug flag
                if (typeof arg === 'number' || arg instanceof Number)
                {
                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, this.socket.options.clientname + ' > Constructor > Constructor flag found', [arg], (this.socket.options.debug >= AJAX.INFO));

                    // Make sure we're dealing with INTEGER type
                    var flag = parseInt(arg);

                    // Is this a flag that is used to configure debugging?
                    if ((flag >= AJAX.QUIET) && (flag <= AJAX.DEBUG))
                    {
                        // Has to be faked with TRUE at end, since debug was formerly disabled
                        AJAX.Log(AJAX.INFO, this.socket.options.clientname + ' > Constructor > Debug flag found', [arg], (flag >= AJAX.INFO));

                        // Set debug mode from passed flag
                        this.debug(flag);
                    }
                    // If an unknown constructor flag was found
                    else
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.ERROR, this.socket.options.clientname + ' > Constructor > Invalid constructor flag', [arg], (this.socket.options.debug >= AJAX.ERROR));
                    }
                }
                // Check if this argument is of type String = the name should be set
                else if (typeof arg === 'string' || arg instanceof String)
                {
                    // Remove leading and trailing whitespaces in passed String argument
                    var value = AJAX.Trim(arg);

                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, this.socket.options.clientname + ' > Constructor > String argument found', [value], (this.socket.options.debug >= AJAX.INFO));

                    // Set the name of this Client to whatever was specified
                    this.name(value);
                }
            }

            // Output log message if debugging
            AJAX.Log(AJAX.INFO, this.socket.options.clientname + ' > Constructor > Done parsing constructor arguments', (this.socket.options.debug >= AJAX.INFO));
            AJAX.Log(AJAX.INFO, this.socket.options.clientname + ' > Constructor > Initializing state handler', (this.socket.options.debug >= AJAX.INFO));

            // CONNECTION STATE HANDLING
            //
            // Defines what happens at various connection and request stages.
            // This function will repeatedly be called by Client.this.socket when Client.socket.readyState changes.
            // 
            // Since it not always works conveniently or reliably, the use of event listeners is mostly preferred.
            this.socket.onreadystatechange = function (eventData)
            {
                // Check if an error in this request's lifetime has already been found and flagged
                if (client.socket.flags.error === true)
                {
                    // Output log message if debugging
                    AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > State Handler > Skipping because of former errors', [client.socket.readyState], (this.options.debug >= AJAX.LOG));

                    // Escape out because we don't need to process further if an error was already reported
                    return false;
                }

                // // Output log message if debugging
                AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > State Handler > AJAX Status', [client.socket.readyState, AJAX.TRANSFER[client.socket.readyState]], (client.socket.options.debug >= AJAX.LOG));
                AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > State Handler > HTTP Status', [client.socket.status, client.socket.statusText], (client.socket.options.debug >= AJAX.LOG));

                // State 0 UNSENT
                //
                // Don't need to deal with readyState 0, because going from (readyState > 0) to (readyState == 0) will never trigger onreadystatechange.
                // This behaviour is intentional, says the XHR specification: https://xhr.spec.whatwg.org/#the-abort%28%29-method

                // State 1 OPENED
                //
                // This happens directly after socket.open() and before socket.send() --> listeners.loadstart(), it's the very first event in the process.
                if (client.socket.readyState === 0)
                {
                    // This will never happen, only here for completeness; just skip out to avoid false error messages.
                    return true;
                }
                else if (client.socket.readyState === 1)
                {
                    // Since nothing has been sent yet, the HTTP status should be 0.
                    if (client.socket.status === 0)
                    {
                        // Update socket status flag
                        client.socket.setStatusFlag(AJAX.STATUS.CONNECTED);

                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > State Handler > Triggering .on.connect()', (client.socket.options.debug >= AJAX.INFO));

                        // If a user-defined event function was assigned
                        if (client.on.connect !== false)
                        {
                            // ...then run it
                            client.on.connect(eventData);
                        }
                        // Else if no user-defined event function was assigned
                        else
                        {
                            // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                            AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.connect() > undefined', (client.socket.options.debug >= AJAX.INFO));
                        }

                        // Escape out, since there's nothing more to do this time around.
                        // This return depends on the HTTP status to be 0, if it's something else the function will continue and run into the error handling.
                        return true;
                    }
                }
                // State 2 HEADERS_RECEIVED
                //
                // This happens after socket.send() --> listeners.loadstart() (when the 'other side' responds) and before listeners.progress() is triggered.
                else if (client.socket.readyState === 2)
                {
                    // If everything went well and the HTTP status is 200 (OK)
                    if (client.socket.status === 200)
                    {
                        // Update socket status flag
                        client.socket.setStatusFlag(AJAX.STATUS.RESPONSE);

                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > State Handler > Triggering .on.response()', (client.socket.options.debug >= AJAX.INFO));

                        // If a user-defined event function was assigned
                        if (client.on.response !== false)
                        {
                            // ...then run it
                            client.on.response(eventData);
                        }
                        // Else if no user-defined event function was assigned
                        else
                        {
                            // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                            AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.response() > undefined', (client.socket.options.debug >= AJAX.INFO));
                        }

                        // Escape out, since there's nothing more to do this time around.
                        // This return depends on the HTTP status to be 0, if it's something else the function will continue and run into the error handling.
                        return true;
                    }
                }
                // State 3 LOADING
                //
                // Triggered while the browser is receiving the requested data. This happens one or multiple times, depending on the browser's chunk size setting,
                // very inconsistent between browsers at small file sizes. This readyState can be ignored because it behaves exactly as listeners.progress() which
                // this script uses instead.
                else if (client.socket.readyState === 3)
                {
                    // Just skip out to avoid false error messages.
                    return true;
                }
                // State 4 DONE
                //
                // This one's a bit weird... it will be triggered in case of success OR failure, and the outcome has to be decided by checking the HTTP status message.
                // However, this will also be triggered with HTTP Status 200 (OK) if the request is aborted or runs into a timeout, but BEFORE the aborted or timeout listeners are called.
                // To avoid any false success reports caused by such behvaiour, this script will simply ignore readyState 3 and rely on listeners.load().
                // listeners.load() is called directly hereafter, but only if NO timeout or NO abort occured, which makes it much more reliable in evaluating success or failure than this.
                else if (client.socket.readyState === 4)
                {
                    // Just skip out to avoid false error messages.
                    return true;
                }

                // ERROR HANDLING
                //
                // If the onreadystatechange() function reaches this section of the code, it means the above evaluation failed and there was some sort of an error.

                // Set the socket error flag to TRUE, informing potential later onreadystatechange() calls about this.
                client.socket.flags.error = true;

                // Update socket status flag
                client.socket.setStatusFlag(AJAX.STATUS.ERROR);

                // Fill an object with information about the error that occured.
                var errorData = {
                    client: client,
                    readyState: client.socket.readyState,
                    readyStateText: AJAX.TRANSFER[client.socket.readyState],
                    status: client.socket.status,
                    statusText: client.socket.statusText,
                    event: eventData
                };

                // Output log message if debugging
                AJAX.Log(AJAX.ERROR, client.socket.options.clientname + ' > State Handler > Error occured', [errorData], (client.socket.options.debug >= AJAX.ERROR));

                // Output log message if debugging
                AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > State Handler > Triggering .on.error()', (client.socket.options.debug >= AJAX.INFO));

                // If a user-defined error callback function was assigned
                if (client.on.error !== false)
                {
                    // ...then run it
                    client.on.error(errorData);
                }
                // Else if no user-defined error callback function was assigned
                else
                {
                    // ...send warning to JS console that there should be one.
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.error() > undefined', (client.socket.options.debug >= AJAX.INFO));
                }

                // Return FALSE to signal that something went wrong.
                return false;
            }; // end this.socket.onreadystatechange ()

            // LISTENER SETUP
            //
            // These listeners will update the value of Client.socket.flags.status, which can be polled with .status() whenever the socket fires certain events.
            // To receive an automated update whenever the status flag changes, assign a function to the Client.on.status() callback slot.

            // ONLOADSTART
            //
            // This will be fired immediately at socket.send() and before socket.readyState reaches 3 (loading/progress).
            // This will happen in any case, success or failure, abort or error.
            this.socket.addEventListener('loadstart', this.socket.listeners.loadstart = function (event)
            {
                // Output log message if debugging
                AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > Listeners > loadstart', (client.socket.options.debug >= AJAX.LOG));

                // Update socket status flag
                client.socket.setStatusFlag(AJAX.STATUS.REQUESTING);

                // Output log message if debugging
                AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.request()', (client.socket.options.debug >= AJAX.INFO));

                // If a user-defined event function was assigned
                if (client.on.request !== false)
                {
                    // ...then run it
                    client.on.request(event);
                }
                // Else if no user-defined event function was assigned
                else
                {
                    // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.request() > undefined', (client.socket.options.debug >= AJAX.INFO));
                }
            }, false);

            // ONPROGRESS
            //
            // This will be fired after on.response() whenever a chunk of data is received by the socket. 
            // This will happen only while successfully receiving a file. It would also happen in case of an error, but I added a socket error flag check to prohibit this.
            //
            // Browsers can have varying chunk sizes; in my tests, IE11 would trigger this several times for a small text file, but Firefox would only trigger this once.
            // It took a significantly longer file to make Firefox trigger this multiple times, but it will do so eventually.
            this.socket.addEventListener('progress', this.socket.listeners.progress = function (event)
            {
                // Only really want to get progress updates if actually downloading something, but not in case of request errors.
                // To enable original behaviour (progress event on error) substitute the if check with a statement that always evaluates to true, like if (true) or so.
                if (client.socket.flags.error === false)
                {
                    // Output log message if debugging
                    AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > Listeners > progress', [((event.loaded * 100) / event.total).toPrecision(2) + ' %'], (client.socket.options.debug >= AJAX.LOG));

                    // Update socket status flag
                    client.socket.setStatusFlag(AJAX.STATUS.RECEIVING);

                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.receive()', (client.socket.options.debug >= AJAX.INFO));

                    // If a user-defined event function was assigned
                    if (client.on.receive !== false)
                    {
                        // ...then run it
                        client.on.receive(event);
                    }
                    // Else if no user-defined event function was assigned
                    else
                    {
                        // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                        AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.receive() > undefined', (client.socket.options.debug >= AJAX.INFO));
                    }
                }
            }, false);

            // ONLOAD
            //
            // This will be triggered when closing the request, so after the last listeners.progress() call and immediately before listeners.loadend() is triggered.
            // This will happen in case of success AND failure, but NOT if timeout or abort were triggered, which makes it more reliable for state evaluation than onreadystatechange().
            this.socket.addEventListener('load', this.socket.listeners.load = function (event)
            {
                // Output log message if debugging
                AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > Listeners > load', (client.socket.options.debug >= AJAX.LOG));

                // If the Client's HTTP status is < 400 (in OK range)
                if (event.target.status < 400)
                {
                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Transfer closed with no errors', (client.socket.options.debug >= AJAX.INFO));

                    // Update statusFlag to SUCCESS
                    client.socket.setStatusFlag(AJAX.STATUS.SUCCESS);

                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.success()', (client.socket.options.debug >= AJAX.INFO));

                    // If a user-defined event function was assigned
                    if (client.on.success !== false)
                    {
                        // ...then run it
                        client.on.success(event);
                    }
                    // Else if no user-defined event function was assigned
                    else
                    {
                        // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                        AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.success() > undefined', (client.socket.options.debug >= AJAX.INFO));
                    }
                }
                // Else if Client's HTTP status is >= 400 (in error range)
                else
                {
                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Transfer closed with errors', (client.socket.options.debug >= AJAX.INFO));

                    // update statusFlag to FAILED
                    client.socket.setStatusFlag(AJAX.STATUS.FAILURE);

                    // Output log message if debugging
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.failure()', (client.socket.options.debug >= AJAX.INFO));

                    // If a user-defined event function was assigned
                    if (client.on.failure !== false)
                    {
                        // ...then run it
                        client.on.failure(event);
                    }
                    // Else if no user-defined event function was assigned
                    else
                    {
                        // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                        AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.failure() > undefined', (client.socket.options.debug >= AJAX.INFO));
                    }
                }
            }, false);

            // ONABORT
            //
            // This will be triggered whenever a transfer is past readyState > 0 (so ongoing) and the socket's .abort() is called.
            // It will NOT be triggered if the readyState is still 0 (initialized but not open) or 4 (done).
            // This script assumes that the result of an aborted request is considered a failure.
            this.socket.addEventListener('abort', this.socket.listeners.abort = function (event)
            {
                // Output log message if debugging
                AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > Listeners > abort', (client.socket.options.debug >= AJAX.LOG));

                // Update socket status flag
                client.socket.setStatusFlag(AJAX.STATUS.ABORTED);

                // Output log message if debugging
                AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.abort()', (client.socket.options.debug >= AJAX.INFO));

                // If a user-defined event function was assigned
                if (client.on.abort !== false)
                {
                    // ...then run it
                    client.on.abort(event);
                }
                // Else if no user-defined event function was assigned
                else
                {
                    // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.abort() > undefined', (client.socket.options.debug >= AJAX.INFO));
                }
            }, false);

            // ONTIMEOUT
            //
            // This will be triggered if a timeout limit is set but the connection takes longer to establish or receive than the limit dictates it may.
            // This will NOT make listeners.load() trigger.
            this.socket.addEventListener('timeout', this.socket.listeners.timeout = function (event)
            {
                // Output log message if debugging
                AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > Listeners > timeout', (client.socket.options.debug >= AJAX.LOG));

                // Update socket status flag
                client.socket.setStatusFlag(AJAX.STATUS.TIMEOUT);

                // Output log message if debugging
                AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.timeout()', (client.socket.options.debug >= AJAX.INFO));

                // If a user-defined event function was assigned
                if (client.on.timeout !== false)
                {
                    // ...then run it
                    client.on.timeout(event);
                }
                // Else if no user-defined event function was assigned
                else
                {
                    // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.timeout() > undefined', (client.socket.options.debug >= AJAX.INFO));
                }
            }, false);

            // ONLOADEND
            //
            // This will be fired as the very last event in the process, after everything else has been triggered and evaluated and closed.
            // This will happen in any case, succes or failure, abort or error.
            // To be consistent with the XHR spec, this will NOT reset the socket's status to 0 (initialized/ready) but leave it as was decided by earlier handlers or listeners.
            this.socket.addEventListener('loadend', this.socket.listeners.loadend = function (event) // immer und als allerletztes
            {
                // Output log message if debugging
                AJAX.Log(AJAX.LOG, client.socket.options.clientname + ' > Listeners > loadend', (client.socket.options.debug >= AJAX.LOG));

                // Don't update socket status flag, just leave as turned out.

                // Output log message if debugging
                AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.complete()', (client.socket.options.debug >= AJAX.INFO));

                // If a user-defined event function was assigned
                if (client.on.complete !== false)
                {
                    // ...then run it
                    client.on.complete(event);
                }
                // Else if no user-defined event function was assigned
                else
                {
                    // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.complete() > undefined', (client.socket.options.debug >= AJAX.INFO));
                }
            }, false);

            // ONERROR
            //
            // This is supposedly triggered at some point, I just don't know yet when. Will have to investigate.
            this.socket.addEventListener('error', this.socket.listeners.error = function (event)
            {
                // Output log message if debugging
                AJAX.Log(AJAX.ERROR, client.socket.options.clientname + ' > Listeners > error', (client.socket.options.debug >= AJAX.ERROR));

                // Update socket status flag
                client.socket.setStatusFlag(AJAX.STATUS.ERROR);

                // Output log message if debugging
                AJAX.Log(AJAX.INFO, client.socket.options.clientname + ' > Listeners > Triggering .on.error()', (client.socket.options.debug >= AJAX.INFO));

                // If a user-defined event function was assigned
                if (client.on.error !== false)
                {
                    // ...then run it
                    client.on.error(event);
                }
                // Else if no user-defined event function was assigned
                else
                {
                    // ...inform JS console about unassigned user function. Not an error or warning, just debugging information.
                    AJAX.Log(AJAX.INFO, client.socket.options.clientname + '.on.error() > undefined', (client.socket.options.debug >= AJAX.INFO));
                }
            }, false);

            // Update socket status flag
            this.socket.setStatusFlag(AJAX.STATUS.READY);

            // Output log message if debugging
            AJAX.Log(AJAX.LOG, this.socket.options.clientname + ' > Constructor > AJAX.Client created', (this.socket.options.debug >= AJAX.LOG));
        } // end AJAX.Client.constructor ()

        // In a world where Internet Explorer understands the JavaScript "class" keyword, this would be the definition of the classes member methods.
        _createClass(Client,
            [
	            // CLIENT NAME
                //
                // This is mostly here for logging convenience. Gives AJAX.Clients names or descriptions
                // for better identification when using multiple instances. This is a label or a tag, but
                // it's not really used in the transmission code itself, it's not necessary to use.
                //
                // Call without an argument to get current value.
                // Call with string argument to set new value.
                //
                // Can be passed as string argument when instantiating, and/or manually set afterwards.
                //
                // var ajax = new AJAX.Client(); 			/* instantiates a client without name */
                // ajax.name('cool name');					/* updates the client's name to "cool name" */
                // var ajax = new AJAX.Client('cool name');	/* instantiates a client with the .name() value of "cool name" */
                // alert(ajax.name());						/* returns the current name of this client */
                {
                    key: 'name',
                    value: function name ()
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, this, '.name() > Called', [arguments]);

                        // Only if an argument was passed
                        if (arguments.length > 0)
                        {
                            var arg = arguments[0];

                            // Check that the argument is of type String
                            if (typeof arg === 'string' || arg instanceof String)
                            {
                                var value = AJAX.Trim(arg);
                                var oldname = this.socket.options.clientname;

                                // Output log message if debugging
                                AJAX.Log(AJAX.INFO, this, '.name() > String argument found', [value]);

                                // Make sure that name is only changed if argument was not an empty string
                                if (value !== '')
                                {
                                    // Update value
                                    this.socket.options.clientname = value;
                                }
                                // Handle case of empty string
                                else
                                {
                                    // Output log message if debugging
                                    AJAX.Log(AJAX.INFO, this, '.name() > String argument empty, removing name');

                                    // Resetting to default
                                    this.socket.options.clientname = 'AJAX.Client';
                                }
                            }

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, oldname + '.name() > Name updated', [this.socket.options.clientname], (this.socket.options.debug >= AJAX.LOG));
                        }

                        // Return current value to caller
                        return this.socket.options.clientname;
                    }
                }, // end AJAX.Client.name ()
                
                // DEBUGGING FLAG
                //
                // If set to AJAX.QUIET, this client will not log any messages (not even errors or warnings) to the browser's JS console.
                // If set to anything above AJAX.QUIET, Clients will output debugging messages of equal or lesser level to console.
                //
                // Call without an argument to get current value.
                // Call with bool value [true,false] or a DEBUG FLAG to set new value.
                //
                // DEBUG FLAGS can also be passed as constructor flags at instantiation.
                //
                // var ajax = new AJAX.Client();			/* instantiates a client with debugging set to default = AJAX.WARNING = only error messages and warnings */
                // ajax.debug(true);						/* sets debugging state to full AJAX.DEBUG, so any Log() message will be sent to the browser's JS console */
                // var ajax = new AJAX.Client(AJAX.DEBUG);	/* instantiates a client with full debugging enabled */
                // alert(ajax.debug());						/* returns the current debug value/state */
                // alert(ajax.debug(false));				/* sets debugging to AJAX.QUIET, so no Log() messages of any kind will be sent to the browser's JS console */
                {
                    key: 'debug',
                    value: function debug ()
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, this, '.debug() > Called', [arguments]);

                        // Only if an argument was passed
                        if (arguments.length > 0)
                        {
                            // Cycle through all passed arguments
                            for (var argument=0; argument<arguments.length; ++argument)
                            {
                                // Convenience variable for the current argument
                                var arg = arguments[argument];

                                // Check if the argument is of type bool
                                if (typeof arg === 'boolean' || arg instanceof Boolean)
                                {
                                    // Output log message if debugging
                                    AJAX.Log(AJAX.INFO, this, '.debug() > Bool argument found', [arg]);

                                    // Update value
                                    this.socket.options.debug = (arg === true) ? AJAX.DEBUG : AJAX.QUIET;
                                }
                                // Check if the argument is of type number
                                else if (typeof arg === 'number' || arg instanceof Number)
                                {
                                    // Make sure we're dealing with an INT
                                    var value = parseInt(arg);

                                    // Output log message if debugging
                                    AJAX.Log(AJAX.INFO, this, '.debug() > Number argument found', [arg]);

                                    // Make sure that argument in valid range
                                    if ([AJAX.QUIET, AJAX.ERROR, AJAX.WARNING, AJAX.LOG, AJAX.INFO, AJAX.DEBUG].indexOf(value) > -1)
                                    {
                                        // Update value
                                        this.socket.options.debug = value;
                                    }
                                }
                            }

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.debug() > Value updated', [this.socket.options.debug], (this.socket.options.debug >= AJAX.LOG));
                        }

                        // Return current value to caller
                        return this.socket.options.debug;
                    }
                }, // end AJAX.Client.debug ()
                
                // REQUEST TIMEOUT LIMIT
                //
                // If set to 0 or false, requests won't time out.
                // If set to Number n > 0, requests will timeout after n milliseconds.
                //
                // This can only be set manually. Set it BEFORE fetching with Client.get() or Client.post().
                //
                // var ajax = new AJAX.Client();	/* instantiates a client with no request timeout */
                // ajax.timeout(2500);				/* sets request timeout limit for this client to 2500ms = 2.5 seconds */
                // ajax.get('http://etc');			/* fetches a get request with 2.5s timeout limit */
                {
                    key: 'timeout',
                    value: function timeout ()
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, this, '.timeout() > Called', [arguments]);

                        // Only if an argument was passed
                        if (arguments.length > 0)
                        {
                            var arg = arguments[0];

                            // Check if the argument is of type bool
                            if (typeof arg === 'boolean' || arg instanceof Boolean)
                            {
                                // Output log message if debugging
                                AJAX.Log(AJAX.INFO, this, '.timeout() > Bool argument found', [arg]);

                                // Only false is allowed, anything else must be int >= 0 for ms time
                                if (arg === false)
                                {
                                    // Update timeout value
                                    this.socket.timeout = 0;
                                }
                                else
                                {
                                    // Output log message if debugging
                                    AJAX.Log(AJAX.WAWRNING, this, '.timeout() > Bool argument can only be false', [arg]);
                                    AJAX.Log(AJAX.LOG, this, '.timeout() > Value NOT updated');

                                    // Escape out to avoid "value updated" message further down
                                    return this.socket.timeout;
                                }
                            }
                            // Check if the argument is of type number
                            else if (typeof arg === 'number' || arg instanceof Number)
                            {
                                // Make sure we're dealing with an INT
                                var value = parseInt(arg);

                                // Output log message if debugging
                                AJAX.Log(AJAX.INFO, this, '.timeout() > Number argument found', [value]);

                                // Check if passed argument is maybe less than 0 (impossible setting)
                                if (value < 0)
                                {
                                    // Take the absolute value of the negative number
                                    value = Math.abs(value);

                                    // Output log message if debugging
                                    AJAX.Log(AJAX.WARNING, this, '.timeout() > Number argument was -' + value + ' < 0 so was inverted', [value]);
                                }

                                // Update timeout value
                                this.socket.timeout = value;
                            }

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.timeout() > Value updated', [this.socket.timeout]);
                        }

                        // Return current value
                        return this.socket.timeout;
                    }
                }, // end AJAX.Client.timeout ()
                
                // ABORT REQUEST
                //
                // Attempts to cancel an ongoing transmission.
                //
                // If a transmission is ongoing (socket.readyState 1-3) then it will be aborted and listeners.aborted() will be fired.
                // If no transmission is ongoing (socket.readyState 0,4) then nothing will happen.
                {
                    key: 'abort',
                    value: function abort ()
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, this, '.abort() > Called');

                        // Abort the ongoing request, only does something if a request is actually ongoing.
                        this.socket.abort();
                    }
                }, // end AJAX.Client.abort ()
                
                // CLIENT STATUS
                //
                // Returns the integer value of the current socket status flag as defined in AJAX.STATUS.
                // Use this to poll the Client's current request state from outside. To receive automatically pushed status updates,
                // assign a function to the Client.on.status() callback slot.
                //
                // If socket status flag is 0, then .status() will return 0 and .statusName() will return "READY".
                {
                    key: 'status',
                    value: function status ()
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, this, '.status() > Called', [this.socket.flags.status]);

                        // Return current value
                        return parseInt(this.socket.flags.status);
                    }
                }, // end AJAX.Client.status ()
                
                // CLIENT STATUS NAME
                //
                // Returns the name/title of the current socket status flag as defined in AJAX.STATUS, but capitalized for better readability.
                //
                // If socket status flag is 0, then .status() will return 0 and .statusName() will return "READY".
                {
                    key: 'statusName',
                    value: function statusName ()
                    {
                        // Prepare a variable to hold the result, initialize it as undefined to detect if something went wrong.
                        var currentName = 'undefined';

                        // Shimming Array.indexOf(), since it cannot be guaranteed to work in all browsers.
                        for (var value=0; value<Object.values(AJAX.STATUS).length; ++value)
                        {
                            if (Object.values(AJAX.STATUS)[value] === this.socket.flags.status)
                            {
                                currentName = Object.keys(AJAX.STATUS)[value];
                            }
                        }

                        // Capitalize first letter, make rest lowercase
                        currentName = currentName.substr(0, 1).toUpperCase() + currentName.substr(1).toLowerCase();

                        // Return the found name/title for the current socket status flag
                        return currentName;
                    }
                }, // end AJAX.Client.statusName ()
                
                // GET
                //
                // Sends a GET request to the specified URL.
                // If you want to pass URL parameters (index.html?page=123) then write them into the URL.
                // Assign functions to the Client.on.success(), Client.on.failure() etc. callbacks to handle the result once it arrives.
                //
                // var ajax = new AJAX.Client();			/* instantiates new AJAX.Client */
                // ajax.on.success = function onSuccess (event) {alert(event.target.responseText);} /* function that handles AJAX response */
                // var result = ajax.get('http://etc');	    /* start a GET request through the AJAX.Client, returns TRUE or FALSE (not an indicator of retrieval success) */
                {
                    key: 'get',
                    value: function get ()
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, this, '.get() > Called');
                        AJAX.Log(AJAX.INFO, this, '.get() > Socket settings', [this.socket.options, arguments]);

                        // Verify that the XMLHttpRequest is actually possible
                        if (this.socket)
                        {
                            // Reset error flag to false
                            this.socket.flags.error = false;

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.get() > Socket available');

                            var url = false; // Used to figure out if a valid URL was passed or not.

                            // Cycle through all passed arguments
                            for (var argument=0; argument<arguments.length; ++argument)
                            {
                                // Convenience variable for the current argument
                                var arg = arguments[argument];

                                // Check if this argument is a string
                                if (typeof arg === 'string' || arg instanceof String)
                                {
                                    // Remove potential whitespaces from beginning and end
                                    var value = AJAX.Trim(arg);

                                    // Output log message if debugging
                                    AJAX.Log(AJAX.INFO, this, '.get() > String argument found', [value]);

                                    // Accept the resulting value as the request URL
                                    url = value;
                                }
                            }

                            // If no valid URL specified
                            if (url === false)
                            {
                                // Output log message if debugging
                                AJAX.Log(AJAX.ERROR, this, '.get() > No valid URL specified, aborting', [arguments]);

                                // Escape out because no valid call
                                return false;
                            }

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.get() > Opening connection');

                            // Open the socket connection to the remote URL and send the request on its way
                            this.socket.open('GET', url, true);

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.get() > Sending request');

                            // Send out the request
                            this.socket.send();

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.get() > Request sent');

                            // Report success
                            return true
                        }
                        // else if no socket present
                        AJAX.Log(AJAX.ERROR, this, '.get() > Socket unavailable', [arguments]);

                        // Escape out because no valid socket
                        return false;
                    }
                }, // end AJAX.Client.get ()
                
                // POST
                //
                // Sends a POST request to the specified URL.
                // If you want to pass URL parameters (index.html?page=123) then write them into the URL.
                // Assign functions to the Client.on.success(), Client.on.failure() etc. callbacks to handle the result once it arrives.
                //
                // var ajax = new ajaxClient();				/* instantiates new AJAX.Client */
                // ajax.on.success = function onSuccess (event) {alert(event.target.responseText);} /* function that handles AJAX response */
                // var result = ajax.post('http://etc');	/* start a POST request through the AJAX.Client, returns TRUE or FALSE (not an indicator of retrieval success) */
                {
                    key: 'post',
                    value: function post ()
                    {
                        // Output log message if debugging
                        AJAX.Log(AJAX.INFO, this, '.post() > Called', [arguments]);
                        AJAX.Log(AJAX.INFO, this, '.post() > Socket settings', [this.socket.options, arguments]);

                        // Verify that the XMLHttpRequest is actually possible
                        if (this.socket)
                        {
                            // Reset error flag to false
                            this.socket.flags.error = false;

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.post() > Socket available');

                            var url = false; // Used to figure out if a valid URL was passed or not.
                            var params = false; // Used to figure out if POST parameters were passed.

                            // Cycle through all passed arguments
                            for (var argument=0; argument<arguments.length; ++argument)
                            {
                                // Convenience variable for the current argument
                                var arg = arguments[argument];

                                // Check if this argument is a string
                                if (typeof arg === 'string' || arg instanceof String)
                                {
                                    // Remove potential whitespaces from beginning and end
                                    var value = AJAX.Trim(arg);

                                    // Output log message if debugging
                                    AJAX.Log(AJAX.INFO, this, '.post() > String argument found', [value]);

                                    // Splitting parameters from URL
                                    var urlSplit = value.split('?');

                                    // Extract URL
                                    url = AJAX.Trim(urlSplit.splice(0, 1));

                                    // Consolidate parameters, if there are any
                                    if (urlSplit.length > 0)
                                    {
                                        // Using ? as separator in case URL params contained that character.
                                        params = AJAX.Trim(urlSplit.join('?'));
                                    }

                                    // Output log message if debugging
                                    AJAX.Log(AJAX.INFO, this, '.post() > URL found?', [url]);
                                    AJAX.Log(AJAX.INFO, this, '.post() > URL parameters found?', [params]);
                                }
                            }

                            // If no valid URL was specified
                            if (url === false)
                            {
                                // Output log message if debugging
                                AJAX.Log(AJAX.ERROR, this, '.post() > No valid URL specified, aborting', [arguments]);

                                // Escape out because no valid call
                                return false;
                            }

                            // Output log message if debugging
                            AJAX.Log(AJAX.LOG, this, '.post() > Opening connection');

                            // Open the socket connection to the remote URL
                            this.socket.open('POST', url, true);

                            // If no POST parameters specified
                            if (params === false)
                            {
                                // Send POST request without URL parameters
                                this.socket.send();

                                // Output log message if debugging
                                AJAX.Log(AJAX.LOG, this, '.post() > Request send without parameters');
                            }
                            // If some POST parameters were specified
                            else if (typeof params === 'string' || params instanceof String)
                            {
                                // Send POST request with parameters
                                this.socket.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                                this.socket.send(params);

                                // Output log message if debugging
                                AJAX.Log(AJAX.LOG, this, '.post() > Request send with parameters');
                            }

                            // Report success
                            return true;
                        }
                        // else if no socket present, output log message if debugging
                        AJAX.Log(AJAX.ERROR, this, '.post() > Socket unavailable', [arguments]);

                        // Escape out because no valid socket
                        return false;
                    }
                } // end AJAX.Client.post ()
            ]);

        // Workaround for Internet Explorer not understanding JavaScript "class" keyword
        return Client;
    }() // end class AJAX.Client ()

}; // end namespace AJAX
