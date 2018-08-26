(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var interactions = [],
    minMoveDistance = 5,
    interact,
    maximumMovesToPersist = 1000, // Should be plenty..
    propertiesToCopy = 'target,pageX,pageY,clientX,clientY,offsetX,offsetY,screenX,screenY,shiftKey,x,y'.split(','), // Stuff that will be on every interaction.
    d = typeof document !== 'undefined' ? document : null;

function Interact(){
    this._elements = [];
}
Interact.prototype.on = function(eventName, target, callback){
    if(!target){
        return;
    }
    target._interactEvents = target._interactEvents || {};
    target._interactEvents[eventName] = target._interactEvents[eventName] || []
    target._interactEvents[eventName].push({
        callback: callback,
        interact: this
    });

    return this;
};
Interact.prototype.emit = function(eventName, target, event, interaction){
    if(!target){
        return;
    }

    var interact = this,
        currentTarget = target;

    interaction.originalEvent = event;
    interaction.preventDefault = function(){
        event.preventDefault();
    }
    interaction.stopPropagation = function(){
        event.stopPropagation();
    }

    while(currentTarget){
        currentTarget._interactEvents &&
        currentTarget._interactEvents[eventName] &&
        currentTarget._interactEvents[eventName].forEach(function(listenerInfo){
            if(listenerInfo.interact === interact){
                listenerInfo.callback.call(interaction, interaction);
            }
        });
        currentTarget = currentTarget.parentNode;
    }

    return this;
};
Interact.prototype.off =
Interact.prototype.removeListener = function(eventName, target, callback){
    if(!target || !target._interactEvents || !target._interactEvents[eventName]){
        return;
    }
    var interactListeners = target._interactEvents[eventName],
        listenerInfo;
    for(var i = 0; i < interactListeners.length; i++) {
        listenerInfo = interactListeners[i];
        if(listenerInfo.interact === interact && listenerInfo.callback === callback){
            interactListeners.splice(i,1);
            i--;
        }
    }

    return this;
};
interact = new Interact();

    // For some reason touch browsers never change the event target during a touch.
    // This is, lets face it, fucking stupid.
function getActualTarget() {
    var scrollX = window.scrollX,
        scrollY = window.scrollY;

    // IE is stupid and doesn't support scrollX/Y
    if(scrollX === undefined){
        scrollX = d.body.scrollLeft;
        scrollY = d.body.scrollTop;
    }

    return d.elementFromPoint(this.pageX - window.scrollX, this.pageY - window.scrollY);
}

function getMoveDistance(x1,y1,x2,y2){
    var adj = Math.abs(x1 - x2),
        opp = Math.abs(y1 - y2);

    return Math.sqrt(Math.pow(adj,2) + Math.pow(opp,2));
}

function destroyInteraction(interaction){
    for(var i = 0; i < interactions.length; i++){
        if(interactions[i].identifier === interaction.identifier){
            interactions.splice(i,1);
        }
    }
}

function getInteraction(identifier){
    for(var i = 0; i < interactions.length; i++){
        if(interactions[i].identifier === identifier){
            return interactions[i];
        }
    }
}

function setInheritedData(interaction, data){
    for(var i = 0; i < propertiesToCopy.length; i++) {
        interaction[propertiesToCopy[i]] = data[propertiesToCopy[i]]
    }
}

function getAngle(deltaPoint){
    return Math.atan2(deltaPoint.x, -deltaPoint.y) * 180 / Math.PI;
}

function Interaction(event, interactionInfo){
    // If there is no event (eg: desktop) just make the identifier undefined
    if(!event){
        event = {};
    }
    // If there is no extra info about the interaction (eg: desktop) just use the event itself
    if(!interactionInfo){
        interactionInfo = event;
    }

    // If there is another interaction with the same ID, something went wrong.
    // KILL IT WITH FIRE!
    var oldInteraction = getInteraction(interactionInfo.identifier);
    oldInteraction && oldInteraction.destroy();

    this.identifier = interactionInfo.identifier;

    this.moves = [];

    interactions.push(this);
}

Interaction.prototype = {
    constructor: Interaction,
    getActualTarget: getActualTarget,
    destroy: function(){
        interact.on('destroy', this.target, this, this);
        destroyInteraction(this);
    },
    start: function(event, interactionInfo){
        // If there is no extra info about the interaction (eg: desktop) just use the event itself
        if(!interactionInfo){
            interactionInfo = event;
        }

        var lastStart = {
                time: new Date(),
                phase: 'start'
            };
        setInheritedData(lastStart, interactionInfo);
        this.lastStart = lastStart;

        setInheritedData(this, interactionInfo);

        this.phase = 'start';
        interact.emit('start', event.target, event, this);
        return this;
    },
    move: function(event, interactionInfo){
        // If there is no extra info about the interaction (eg: desktop) just use the event itself
        if(!interactionInfo){
            interactionInfo = event;
        }

        var currentTouch = {
                time: new Date(),
                phase: 'move'
            };

        setInheritedData(currentTouch, interactionInfo);

        // Update the interaction
        setInheritedData(this, interactionInfo);

        this.moves.push(currentTouch);

        // Memory saver, culls any moves that are over the maximum to keep.
        this.moves = this.moves.slice(-maximumMovesToPersist);

        var moveDelta = this.getMoveDelta(),
            angle = 0;
        if(moveDelta){
            angle = getAngle(moveDelta);
        }

        this.angle = currentTouch.angle = angle;

        this.phase = 'move';
        interact.emit('move', event.target, event, this);
        return this;
    },
    drag: function(event, interactionInfo){
        // If there is no extra info about the interaction (eg: desktop) just use the event itself
        if(!interactionInfo){
            interactionInfo = event;
        }

        var currentTouch = {
                time: new Date(),
                phase: 'drag'
            };

        setInheritedData(currentTouch, interactionInfo);

        // Update the interaction
        setInheritedData(this, interactionInfo);

        if(!this.moves){
            this.moves = [];
        }

        this.moves.push(currentTouch);

        // Memory saver, culls any moves that are over the maximum to keep.
        this.moves = this.moves.slice(-maximumMovesToPersist);

        if(!this.dragStarted && getMoveDistance(this.lastStart.pageX, this.lastStart.pageY, currentTouch.pageX, currentTouch.pageY) > minMoveDistance){
            this.dragStarted = true;
        }

        var moveDelta = this.getMoveDelta(),
            angle = 0;
        if(moveDelta){
            angle = getAngle(moveDelta);
        }

        this.angle = currentTouch.angle = angle;

        if(this.dragStarted){
            this.phase = 'drag';
            interact.emit('drag', event.target, event, this);
        }
        return this;
    },
    end: function(event, interactionInfo){
        if(!interactionInfo){
            interactionInfo = event;
        }

        // Update the interaction
        setInheritedData(this, interactionInfo);

        if(!this.moves){
            this.moves = [];
        }

        // Update the interaction
        setInheritedData(this, interactionInfo);

        this.phase = 'end';
        interact.emit('end', event.target, event, this);

        return this;
    },
    cancel: function(event, interactionInfo){
        if(!interactionInfo){
            interactionInfo = event;
        }

        // Update the interaction
        setInheritedData(this, interactionInfo);

        this.phase = 'cancel';
        interact.emit('cancel', event.target, event, this);

        return this;
    },
    getMoveDistance: function(){
        if(this.moves.length > 1){
            var current = this.moves[this.moves.length-1],
                previous = this.moves[this.moves.length-2];

            return getMoveDistance(current.pageX, current.pageY, previous.pageX, previous.pageY);
        }
    },
    getMoveDelta: function(){
        var current = this.moves[this.moves.length-1],
            previous = this.moves[this.moves.length-2] || this.lastStart;

        if(!current || !previous){
            return;
        }

        return {
            x: current.pageX - previous.pageX,
            y: current.pageY - previous.pageY
        };
    },
    getSpeed: function(){
        if(this.moves.length > 1){
            var current = this.moves[this.moves.length-1],
                previous = this.moves[this.moves.length-2];

            return this.getMoveDistance() / (current.time - previous.time);
        }
        return 0;
    },
    getCurrentAngle: function(blend){
        var phase = this.phase,
            currentPosition,
            lastAngle,
            i = this.moves.length-1,
            angle,
            firstAngle,
            angles = [],
            blendSteps = 20/(this.getSpeed()*2+1),
            stepsUsed = 1;

        if(this.moves && this.moves.length){

            currentPosition = this.moves[i];
            angle = firstAngle = currentPosition.angle;

            if(blend && this.moves.length > 1){
                while(
                    --i > 0 &&
                    this.moves.length - i < blendSteps &&
                    this.moves[i].phase === phase
                ){
                    lastAngle = this.moves[i].angle;
                    if(Math.abs(lastAngle - firstAngle) > 180){
                        angle -= lastAngle;
                    }else{
                        angle += lastAngle;
                    }
                    stepsUsed++;
                }
                angle = angle/stepsUsed;
            }
        }
        if(angle === Infinity){
            return firstAngle;
        }
        return angle;
    },
    getAllInteractions: function(){
        return interactions.slice();
    }
};

function start(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        new Interaction(event, event.changedTouches[i]).start(event, touch);
    }
}
function drag(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        getInteraction(touch.identifier).drag(event, touch);
    }
}
function end(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        getInteraction(touch.identifier).end(event, touch).destroy();
    }
}
function cancel(event){
    var touch;

    for(var i = 0; i < event.changedTouches.length; i++){
        touch = event.changedTouches[i];
        getInteraction(touch.identifier).cancel(event, touch).destroy();
    }
}

addEvent(d, 'touchstart', start);
addEvent(d, 'touchmove', drag);
addEvent(d, 'touchend', end);
addEvent(d, 'touchcancel', cancel);

var mouseIsDown = false;
addEvent(d, 'mousedown', function(event){
    mouseIsDown = true;

    if(!interactions.length){
        new Interaction(event);
    }

    var interaction = getInteraction();

    if(!interaction){
        return;
    }

    getInteraction().start(event);
});
addEvent(d, 'mousemove', function(event){
    if(!interactions.length){
        new Interaction(event);
    }

    var interaction = getInteraction();

    if(!interaction){
        return;
    }

    if(mouseIsDown){
        interaction.drag(event);
    }else{
        interaction.move(event);
    }
});
addEvent(d, 'mouseup', function(event){
    mouseIsDown = false;

    var interaction = getInteraction();

    if(!interaction){
        return;
    }

    interaction.end(event, null);
    interaction.destroy();
});

function addEvent(element, type, callback) {
    if(element == null){
        return;
    }

    if(element.addEventListener){
        element.addEventListener(type, callback, { passive: false });
    }
    else if(d.attachEvent){
        element.attachEvent("on"+ type, callback, { passive: false });
    }
}

module.exports = interact;
},{}],2:[function(require,module,exports){
//Copyright (C) 2012 Kory Nunn

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*

    This code is not formatted for readability, but rather run-speed and to assist compilers.

    However, the code's intention should be transparent.

    *** IE SUPPORT ***

    If you require this library to work in IE7, add the following after declaring crel.

    var testDiv = document.createElement('div'),
        testLabel = document.createElement('label');

    testDiv.setAttribute('class', 'a');
    testDiv['className'] !== 'a' ? crel.attrMap['class'] = 'className':undefined;
    testDiv.setAttribute('name','a');
    testDiv['name'] !== 'a' ? crel.attrMap['name'] = function(element, value){
        element.id = value;
    }:undefined;


    testLabel.setAttribute('for', 'a');
    testLabel['htmlFor'] !== 'a' ? crel.attrMap['for'] = 'htmlFor':undefined;



*/

(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.crel = factory();
    }
}(this, function () {
    // based on http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
    var isNode = typeof Node === 'function'
        ? function (object) { return object instanceof Node; }
        : function (object) {
            return object
                && typeof object === 'object'
                && typeof object.nodeType === 'number'
                && typeof object.nodeName === 'string';
        };
    var isArray = function(a){ return a instanceof Array; };
    var appendChild = function(element, child) {
      if(!isNode(child)){
          child = document.createTextNode(child);
      }
      element.appendChild(child);
    };


    function crel(){
        var document = window.document,
            args = arguments, //Note: assigned to a variable to assist compilers. Saves about 40 bytes in closure compiler. Has negligable effect on performance.
            element = args[0],
            child,
            settings = args[1],
            childIndex = 2,
            argumentsLength = args.length,
            attributeMap = crel.attrMap;

        element = isNode(element) ? element : document.createElement(element);
        // shortcut
        if(argumentsLength === 1){
            return element;
        }

        if(typeof settings !== 'object' || isNode(settings) || isArray(settings)) {
            --childIndex;
            settings = null;
        }

        // shortcut if there is only one child that is a string
        if((argumentsLength - childIndex) === 1 && typeof args[childIndex] === 'string' && element.textContent !== undefined){
            element.textContent = args[childIndex];
        }else{
            for(; childIndex < argumentsLength; ++childIndex){
                child = args[childIndex];

                if(child == null){
                    continue;
                }

                if (isArray(child)) {
                  for (var i=0; i < child.length; ++i) {
                    appendChild(element, child[i]);
                  }
                } else {
                  appendChild(element, child);
                }
            }
        }

        for(var key in settings){
            if(!attributeMap[key]){
                element.setAttribute(key, settings[key]);
            }else{
                var attr = crel.attrMap[key];
                if(typeof attr === 'function'){
                    attr(element, settings[key]);
                }else{
                    element.setAttribute(attr, settings[key]);
                }
            }
        }

        return element;
    }

    // Used for mapping one kind of attribute to the supported version of that in bad browsers.
    // String referenced so that compilers maintain the property name.
    crel['attrMap'] = {};

    // String referenced so that compilers maintain the property name.
    crel["isNode"] = isNode;

    return crel;
}));

},{}],3:[function(require,module,exports){
var interact = require('./'),
    crel = require('crel');

window.onload = function(){

    var log = [],
        output

    crel(document.body,
        output = crel('div')
    );

    var toLog = 'pageX pageY identifier angle'.split(' ');

    var eventHandler = function(interaction){
        interaction.preventDefault();

        log.push(interaction);
        var info = '';

        for(var key in interaction){
            if(~toLog.indexOf(key)){
                info += key + ': ' + interaction[key] + ' ';
            }
        }

        crel(output,
            crel('p', interaction.phase, crel('br'), info, crel('br'), 'nicer angle: ' + interaction.getCurrentAngle(true))
        );

        if(output.childNodes.length > 10){
            output.removeChild(output.childNodes[0]);
        }
    };

    interact.on('move', document.body, eventHandler);
    interact.on('start', document.body, eventHandler);
    interact.on('drag', document.body, eventHandler);
    interact.on('end', document.body, eventHandler);
    interact.on('cancel', document.body, eventHandler);

};
},{"./":1,"crel":2}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbnRlcmFjdC5qcyIsIm5vZGVfbW9kdWxlcy9jcmVsL2NyZWwuanMiLCJ0ZXN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzliQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgaW50ZXJhY3Rpb25zID0gW10sXHJcbiAgICBtaW5Nb3ZlRGlzdGFuY2UgPSA1LFxyXG4gICAgaW50ZXJhY3QsXHJcbiAgICBtYXhpbXVtTW92ZXNUb1BlcnNpc3QgPSAxMDAwLCAvLyBTaG91bGQgYmUgcGxlbnR5Li5cclxuICAgIHByb3BlcnRpZXNUb0NvcHkgPSAndGFyZ2V0LHBhZ2VYLHBhZ2VZLGNsaWVudFgsY2xpZW50WSxvZmZzZXRYLG9mZnNldFksc2NyZWVuWCxzY3JlZW5ZLHNoaWZ0S2V5LHgseScuc3BsaXQoJywnKSwgLy8gU3R1ZmYgdGhhdCB3aWxsIGJlIG9uIGV2ZXJ5IGludGVyYWN0aW9uLlxyXG4gICAgZCA9IHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgPyBkb2N1bWVudCA6IG51bGw7XHJcblxyXG5mdW5jdGlvbiBJbnRlcmFjdCgpe1xyXG4gICAgdGhpcy5fZWxlbWVudHMgPSBbXTtcclxufVxyXG5JbnRlcmFjdC5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudE5hbWUsIHRhcmdldCwgY2FsbGJhY2spe1xyXG4gICAgaWYoIXRhcmdldCl7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGFyZ2V0Ll9pbnRlcmFjdEV2ZW50cyA9IHRhcmdldC5faW50ZXJhY3RFdmVudHMgfHwge307XHJcbiAgICB0YXJnZXQuX2ludGVyYWN0RXZlbnRzW2V2ZW50TmFtZV0gPSB0YXJnZXQuX2ludGVyYWN0RXZlbnRzW2V2ZW50TmFtZV0gfHwgW11cclxuICAgIHRhcmdldC5faW50ZXJhY3RFdmVudHNbZXZlbnROYW1lXS5wdXNoKHtcclxuICAgICAgICBjYWxsYmFjazogY2FsbGJhY2ssXHJcbiAgICAgICAgaW50ZXJhY3Q6IHRoaXNcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5JbnRlcmFjdC5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgdGFyZ2V0LCBldmVudCwgaW50ZXJhY3Rpb24pe1xyXG4gICAgaWYoIXRhcmdldCl7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBpbnRlcmFjdCA9IHRoaXMsXHJcbiAgICAgICAgY3VycmVudFRhcmdldCA9IHRhcmdldDtcclxuXHJcbiAgICBpbnRlcmFjdGlvbi5vcmlnaW5hbEV2ZW50ID0gZXZlbnQ7XHJcbiAgICBpbnRlcmFjdGlvbi5wcmV2ZW50RGVmYXVsdCA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgIH1cclxuICAgIGludGVyYWN0aW9uLnN0b3BQcm9wYWdhdGlvbiA9IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB9XHJcblxyXG4gICAgd2hpbGUoY3VycmVudFRhcmdldCl7XHJcbiAgICAgICAgY3VycmVudFRhcmdldC5faW50ZXJhY3RFdmVudHMgJiZcclxuICAgICAgICBjdXJyZW50VGFyZ2V0Ll9pbnRlcmFjdEV2ZW50c1tldmVudE5hbWVdICYmXHJcbiAgICAgICAgY3VycmVudFRhcmdldC5faW50ZXJhY3RFdmVudHNbZXZlbnROYW1lXS5mb3JFYWNoKGZ1bmN0aW9uKGxpc3RlbmVySW5mbyl7XHJcbiAgICAgICAgICAgIGlmKGxpc3RlbmVySW5mby5pbnRlcmFjdCA9PT0gaW50ZXJhY3Qpe1xyXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJJbmZvLmNhbGxiYWNrLmNhbGwoaW50ZXJhY3Rpb24sIGludGVyYWN0aW9uKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGN1cnJlbnRUYXJnZXQgPSBjdXJyZW50VGFyZ2V0LnBhcmVudE5vZGU7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcbkludGVyYWN0LnByb3RvdHlwZS5vZmYgPVxyXG5JbnRlcmFjdC5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbihldmVudE5hbWUsIHRhcmdldCwgY2FsbGJhY2spe1xyXG4gICAgaWYoIXRhcmdldCB8fCAhdGFyZ2V0Ll9pbnRlcmFjdEV2ZW50cyB8fCAhdGFyZ2V0Ll9pbnRlcmFjdEV2ZW50c1tldmVudE5hbWVdKXtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB2YXIgaW50ZXJhY3RMaXN0ZW5lcnMgPSB0YXJnZXQuX2ludGVyYWN0RXZlbnRzW2V2ZW50TmFtZV0sXHJcbiAgICAgICAgbGlzdGVuZXJJbmZvO1xyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGludGVyYWN0TGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgbGlzdGVuZXJJbmZvID0gaW50ZXJhY3RMaXN0ZW5lcnNbaV07XHJcbiAgICAgICAgaWYobGlzdGVuZXJJbmZvLmludGVyYWN0ID09PSBpbnRlcmFjdCAmJiBsaXN0ZW5lckluZm8uY2FsbGJhY2sgPT09IGNhbGxiYWNrKXtcclxuICAgICAgICAgICAgaW50ZXJhY3RMaXN0ZW5lcnMuc3BsaWNlKGksMSk7XHJcbiAgICAgICAgICAgIGktLTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcbmludGVyYWN0ID0gbmV3IEludGVyYWN0KCk7XHJcblxyXG4gICAgLy8gRm9yIHNvbWUgcmVhc29uIHRvdWNoIGJyb3dzZXJzIG5ldmVyIGNoYW5nZSB0aGUgZXZlbnQgdGFyZ2V0IGR1cmluZyBhIHRvdWNoLlxyXG4gICAgLy8gVGhpcyBpcywgbGV0cyBmYWNlIGl0LCBmdWNraW5nIHN0dXBpZC5cclxuZnVuY3Rpb24gZ2V0QWN0dWFsVGFyZ2V0KCkge1xyXG4gICAgdmFyIHNjcm9sbFggPSB3aW5kb3cuc2Nyb2xsWCxcclxuICAgICAgICBzY3JvbGxZID0gd2luZG93LnNjcm9sbFk7XHJcblxyXG4gICAgLy8gSUUgaXMgc3R1cGlkIGFuZCBkb2Vzbid0IHN1cHBvcnQgc2Nyb2xsWC9ZXHJcbiAgICBpZihzY3JvbGxYID09PSB1bmRlZmluZWQpe1xyXG4gICAgICAgIHNjcm9sbFggPSBkLmJvZHkuc2Nyb2xsTGVmdDtcclxuICAgICAgICBzY3JvbGxZID0gZC5ib2R5LnNjcm9sbFRvcDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZC5lbGVtZW50RnJvbVBvaW50KHRoaXMucGFnZVggLSB3aW5kb3cuc2Nyb2xsWCwgdGhpcy5wYWdlWSAtIHdpbmRvdy5zY3JvbGxZKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TW92ZURpc3RhbmNlKHgxLHkxLHgyLHkyKXtcclxuICAgIHZhciBhZGogPSBNYXRoLmFicyh4MSAtIHgyKSxcclxuICAgICAgICBvcHAgPSBNYXRoLmFicyh5MSAtIHkyKTtcclxuXHJcbiAgICByZXR1cm4gTWF0aC5zcXJ0KE1hdGgucG93KGFkaiwyKSArIE1hdGgucG93KG9wcCwyKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRlc3Ryb3lJbnRlcmFjdGlvbihpbnRlcmFjdGlvbil7XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgaW50ZXJhY3Rpb25zLmxlbmd0aDsgaSsrKXtcclxuICAgICAgICBpZihpbnRlcmFjdGlvbnNbaV0uaWRlbnRpZmllciA9PT0gaW50ZXJhY3Rpb24uaWRlbnRpZmllcil7XHJcbiAgICAgICAgICAgIGludGVyYWN0aW9ucy5zcGxpY2UoaSwxKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEludGVyYWN0aW9uKGlkZW50aWZpZXIpe1xyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGludGVyYWN0aW9ucy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgaWYoaW50ZXJhY3Rpb25zW2ldLmlkZW50aWZpZXIgPT09IGlkZW50aWZpZXIpe1xyXG4gICAgICAgICAgICByZXR1cm4gaW50ZXJhY3Rpb25zW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2V0SW5oZXJpdGVkRGF0YShpbnRlcmFjdGlvbiwgZGF0YSl7XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgcHJvcGVydGllc1RvQ29weS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGludGVyYWN0aW9uW3Byb3BlcnRpZXNUb0NvcHlbaV1dID0gZGF0YVtwcm9wZXJ0aWVzVG9Db3B5W2ldXVxyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRBbmdsZShkZWx0YVBvaW50KXtcclxuICAgIHJldHVybiBNYXRoLmF0YW4yKGRlbHRhUG9pbnQueCwgLWRlbHRhUG9pbnQueSkgKiAxODAgLyBNYXRoLlBJO1xyXG59XHJcblxyXG5mdW5jdGlvbiBJbnRlcmFjdGlvbihldmVudCwgaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgIC8vIElmIHRoZXJlIGlzIG5vIGV2ZW50IChlZzogZGVza3RvcCkganVzdCBtYWtlIHRoZSBpZGVudGlmaWVyIHVuZGVmaW5lZFxyXG4gICAgaWYoIWV2ZW50KXtcclxuICAgICAgICBldmVudCA9IHt9O1xyXG4gICAgfVxyXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gZXh0cmEgaW5mbyBhYm91dCB0aGUgaW50ZXJhY3Rpb24gKGVnOiBkZXNrdG9wKSBqdXN0IHVzZSB0aGUgZXZlbnQgaXRzZWxmXHJcbiAgICBpZighaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICBpbnRlcmFjdGlvbkluZm8gPSBldmVudDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBJZiB0aGVyZSBpcyBhbm90aGVyIGludGVyYWN0aW9uIHdpdGggdGhlIHNhbWUgSUQsIHNvbWV0aGluZyB3ZW50IHdyb25nLlxyXG4gICAgLy8gS0lMTCBJVCBXSVRIIEZJUkUhXHJcbiAgICB2YXIgb2xkSW50ZXJhY3Rpb24gPSBnZXRJbnRlcmFjdGlvbihpbnRlcmFjdGlvbkluZm8uaWRlbnRpZmllcik7XHJcbiAgICBvbGRJbnRlcmFjdGlvbiAmJiBvbGRJbnRlcmFjdGlvbi5kZXN0cm95KCk7XHJcblxyXG4gICAgdGhpcy5pZGVudGlmaWVyID0gaW50ZXJhY3Rpb25JbmZvLmlkZW50aWZpZXI7XHJcblxyXG4gICAgdGhpcy5tb3ZlcyA9IFtdO1xyXG5cclxuICAgIGludGVyYWN0aW9ucy5wdXNoKHRoaXMpO1xyXG59XHJcblxyXG5JbnRlcmFjdGlvbi5wcm90b3R5cGUgPSB7XHJcbiAgICBjb25zdHJ1Y3RvcjogSW50ZXJhY3Rpb24sXHJcbiAgICBnZXRBY3R1YWxUYXJnZXQ6IGdldEFjdHVhbFRhcmdldCxcclxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgaW50ZXJhY3Qub24oJ2Rlc3Ryb3knLCB0aGlzLnRhcmdldCwgdGhpcywgdGhpcyk7XHJcbiAgICAgICAgZGVzdHJveUludGVyYWN0aW9uKHRoaXMpO1xyXG4gICAgfSxcclxuICAgIHN0YXJ0OiBmdW5jdGlvbihldmVudCwgaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyBleHRyYSBpbmZvIGFib3V0IHRoZSBpbnRlcmFjdGlvbiAoZWc6IGRlc2t0b3ApIGp1c3QgdXNlIHRoZSBldmVudCBpdHNlbGZcclxuICAgICAgICBpZighaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAgICAgaW50ZXJhY3Rpb25JbmZvID0gZXZlbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgbGFzdFN0YXJ0ID0ge1xyXG4gICAgICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcclxuICAgICAgICAgICAgICAgIHBoYXNlOiAnc3RhcnQnXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgc2V0SW5oZXJpdGVkRGF0YShsYXN0U3RhcnQsIGludGVyYWN0aW9uSW5mbyk7XHJcbiAgICAgICAgdGhpcy5sYXN0U3RhcnQgPSBsYXN0U3RhcnQ7XHJcblxyXG4gICAgICAgIHNldEluaGVyaXRlZERhdGEodGhpcywgaW50ZXJhY3Rpb25JbmZvKTtcclxuXHJcbiAgICAgICAgdGhpcy5waGFzZSA9ICdzdGFydCc7XHJcbiAgICAgICAgaW50ZXJhY3QuZW1pdCgnc3RhcnQnLCBldmVudC50YXJnZXQsIGV2ZW50LCB0aGlzKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcbiAgICBtb3ZlOiBmdW5jdGlvbihldmVudCwgaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyBleHRyYSBpbmZvIGFib3V0IHRoZSBpbnRlcmFjdGlvbiAoZWc6IGRlc2t0b3ApIGp1c3QgdXNlIHRoZSBldmVudCBpdHNlbGZcclxuICAgICAgICBpZighaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAgICAgaW50ZXJhY3Rpb25JbmZvID0gZXZlbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY3VycmVudFRvdWNoID0ge1xyXG4gICAgICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcclxuICAgICAgICAgICAgICAgIHBoYXNlOiAnbW92ZSdcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgc2V0SW5oZXJpdGVkRGF0YShjdXJyZW50VG91Y2gsIGludGVyYWN0aW9uSW5mbyk7XHJcblxyXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgaW50ZXJhY3Rpb25cclxuICAgICAgICBzZXRJbmhlcml0ZWREYXRhKHRoaXMsIGludGVyYWN0aW9uSW5mbyk7XHJcblxyXG4gICAgICAgIHRoaXMubW92ZXMucHVzaChjdXJyZW50VG91Y2gpO1xyXG5cclxuICAgICAgICAvLyBNZW1vcnkgc2F2ZXIsIGN1bGxzIGFueSBtb3ZlcyB0aGF0IGFyZSBvdmVyIHRoZSBtYXhpbXVtIHRvIGtlZXAuXHJcbiAgICAgICAgdGhpcy5tb3ZlcyA9IHRoaXMubW92ZXMuc2xpY2UoLW1heGltdW1Nb3Zlc1RvUGVyc2lzdCk7XHJcblxyXG4gICAgICAgIHZhciBtb3ZlRGVsdGEgPSB0aGlzLmdldE1vdmVEZWx0YSgpLFxyXG4gICAgICAgICAgICBhbmdsZSA9IDA7XHJcbiAgICAgICAgaWYobW92ZURlbHRhKXtcclxuICAgICAgICAgICAgYW5nbGUgPSBnZXRBbmdsZShtb3ZlRGVsdGEpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hbmdsZSA9IGN1cnJlbnRUb3VjaC5hbmdsZSA9IGFuZ2xlO1xyXG5cclxuICAgICAgICB0aGlzLnBoYXNlID0gJ21vdmUnO1xyXG4gICAgICAgIGludGVyYWN0LmVtaXQoJ21vdmUnLCBldmVudC50YXJnZXQsIGV2ZW50LCB0aGlzKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcbiAgICBkcmFnOiBmdW5jdGlvbihldmVudCwgaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyBleHRyYSBpbmZvIGFib3V0IHRoZSBpbnRlcmFjdGlvbiAoZWc6IGRlc2t0b3ApIGp1c3QgdXNlIHRoZSBldmVudCBpdHNlbGZcclxuICAgICAgICBpZighaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAgICAgaW50ZXJhY3Rpb25JbmZvID0gZXZlbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY3VycmVudFRvdWNoID0ge1xyXG4gICAgICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcclxuICAgICAgICAgICAgICAgIHBoYXNlOiAnZHJhZydcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgc2V0SW5oZXJpdGVkRGF0YShjdXJyZW50VG91Y2gsIGludGVyYWN0aW9uSW5mbyk7XHJcblxyXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgaW50ZXJhY3Rpb25cclxuICAgICAgICBzZXRJbmhlcml0ZWREYXRhKHRoaXMsIGludGVyYWN0aW9uSW5mbyk7XHJcblxyXG4gICAgICAgIGlmKCF0aGlzLm1vdmVzKXtcclxuICAgICAgICAgICAgdGhpcy5tb3ZlcyA9IFtdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5tb3Zlcy5wdXNoKGN1cnJlbnRUb3VjaCk7XHJcblxyXG4gICAgICAgIC8vIE1lbW9yeSBzYXZlciwgY3VsbHMgYW55IG1vdmVzIHRoYXQgYXJlIG92ZXIgdGhlIG1heGltdW0gdG8ga2VlcC5cclxuICAgICAgICB0aGlzLm1vdmVzID0gdGhpcy5tb3Zlcy5zbGljZSgtbWF4aW11bU1vdmVzVG9QZXJzaXN0KTtcclxuXHJcbiAgICAgICAgaWYoIXRoaXMuZHJhZ1N0YXJ0ZWQgJiYgZ2V0TW92ZURpc3RhbmNlKHRoaXMubGFzdFN0YXJ0LnBhZ2VYLCB0aGlzLmxhc3RTdGFydC5wYWdlWSwgY3VycmVudFRvdWNoLnBhZ2VYLCBjdXJyZW50VG91Y2gucGFnZVkpID4gbWluTW92ZURpc3RhbmNlKXtcclxuICAgICAgICAgICAgdGhpcy5kcmFnU3RhcnRlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgbW92ZURlbHRhID0gdGhpcy5nZXRNb3ZlRGVsdGEoKSxcclxuICAgICAgICAgICAgYW5nbGUgPSAwO1xyXG4gICAgICAgIGlmKG1vdmVEZWx0YSl7XHJcbiAgICAgICAgICAgIGFuZ2xlID0gZ2V0QW5nbGUobW92ZURlbHRhKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuYW5nbGUgPSBjdXJyZW50VG91Y2guYW5nbGUgPSBhbmdsZTtcclxuXHJcbiAgICAgICAgaWYodGhpcy5kcmFnU3RhcnRlZCl7XHJcbiAgICAgICAgICAgIHRoaXMucGhhc2UgPSAnZHJhZyc7XHJcbiAgICAgICAgICAgIGludGVyYWN0LmVtaXQoJ2RyYWcnLCBldmVudC50YXJnZXQsIGV2ZW50LCB0aGlzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG4gICAgZW5kOiBmdW5jdGlvbihldmVudCwgaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICBpZighaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAgICAgaW50ZXJhY3Rpb25JbmZvID0gZXZlbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBVcGRhdGUgdGhlIGludGVyYWN0aW9uXHJcbiAgICAgICAgc2V0SW5oZXJpdGVkRGF0YSh0aGlzLCBpbnRlcmFjdGlvbkluZm8pO1xyXG5cclxuICAgICAgICBpZighdGhpcy5tb3Zlcyl7XHJcbiAgICAgICAgICAgIHRoaXMubW92ZXMgPSBbXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgaW50ZXJhY3Rpb25cclxuICAgICAgICBzZXRJbmhlcml0ZWREYXRhKHRoaXMsIGludGVyYWN0aW9uSW5mbyk7XHJcblxyXG4gICAgICAgIHRoaXMucGhhc2UgPSAnZW5kJztcclxuICAgICAgICBpbnRlcmFjdC5lbWl0KCdlbmQnLCBldmVudC50YXJnZXQsIGV2ZW50LCB0aGlzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG4gICAgY2FuY2VsOiBmdW5jdGlvbihldmVudCwgaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICBpZighaW50ZXJhY3Rpb25JbmZvKXtcclxuICAgICAgICAgICAgaW50ZXJhY3Rpb25JbmZvID0gZXZlbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBVcGRhdGUgdGhlIGludGVyYWN0aW9uXHJcbiAgICAgICAgc2V0SW5oZXJpdGVkRGF0YSh0aGlzLCBpbnRlcmFjdGlvbkluZm8pO1xyXG5cclxuICAgICAgICB0aGlzLnBoYXNlID0gJ2NhbmNlbCc7XHJcbiAgICAgICAgaW50ZXJhY3QuZW1pdCgnY2FuY2VsJywgZXZlbnQudGFyZ2V0LCBldmVudCwgdGhpcyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuICAgIGdldE1vdmVEaXN0YW5jZTogZnVuY3Rpb24oKXtcclxuICAgICAgICBpZih0aGlzLm1vdmVzLmxlbmd0aCA+IDEpe1xyXG4gICAgICAgICAgICB2YXIgY3VycmVudCA9IHRoaXMubW92ZXNbdGhpcy5tb3Zlcy5sZW5ndGgtMV0sXHJcbiAgICAgICAgICAgICAgICBwcmV2aW91cyA9IHRoaXMubW92ZXNbdGhpcy5tb3Zlcy5sZW5ndGgtMl07XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gZ2V0TW92ZURpc3RhbmNlKGN1cnJlbnQucGFnZVgsIGN1cnJlbnQucGFnZVksIHByZXZpb3VzLnBhZ2VYLCBwcmV2aW91cy5wYWdlWSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGdldE1vdmVEZWx0YTogZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgY3VycmVudCA9IHRoaXMubW92ZXNbdGhpcy5tb3Zlcy5sZW5ndGgtMV0sXHJcbiAgICAgICAgICAgIHByZXZpb3VzID0gdGhpcy5tb3Zlc1t0aGlzLm1vdmVzLmxlbmd0aC0yXSB8fCB0aGlzLmxhc3RTdGFydDtcclxuXHJcbiAgICAgICAgaWYoIWN1cnJlbnQgfHwgIXByZXZpb3VzKXtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgeDogY3VycmVudC5wYWdlWCAtIHByZXZpb3VzLnBhZ2VYLFxyXG4gICAgICAgICAgICB5OiBjdXJyZW50LnBhZ2VZIC0gcHJldmlvdXMucGFnZVlcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuICAgIGdldFNwZWVkOiBmdW5jdGlvbigpe1xyXG4gICAgICAgIGlmKHRoaXMubW92ZXMubGVuZ3RoID4gMSl7XHJcbiAgICAgICAgICAgIHZhciBjdXJyZW50ID0gdGhpcy5tb3Zlc1t0aGlzLm1vdmVzLmxlbmd0aC0xXSxcclxuICAgICAgICAgICAgICAgIHByZXZpb3VzID0gdGhpcy5tb3Zlc1t0aGlzLm1vdmVzLmxlbmd0aC0yXTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldE1vdmVEaXN0YW5jZSgpIC8gKGN1cnJlbnQudGltZSAtIHByZXZpb3VzLnRpbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIH0sXHJcbiAgICBnZXRDdXJyZW50QW5nbGU6IGZ1bmN0aW9uKGJsZW5kKXtcclxuICAgICAgICB2YXIgcGhhc2UgPSB0aGlzLnBoYXNlLFxyXG4gICAgICAgICAgICBjdXJyZW50UG9zaXRpb24sXHJcbiAgICAgICAgICAgIGxhc3RBbmdsZSxcclxuICAgICAgICAgICAgaSA9IHRoaXMubW92ZXMubGVuZ3RoLTEsXHJcbiAgICAgICAgICAgIGFuZ2xlLFxyXG4gICAgICAgICAgICBmaXJzdEFuZ2xlLFxyXG4gICAgICAgICAgICBhbmdsZXMgPSBbXSxcclxuICAgICAgICAgICAgYmxlbmRTdGVwcyA9IDIwLyh0aGlzLmdldFNwZWVkKCkqMisxKSxcclxuICAgICAgICAgICAgc3RlcHNVc2VkID0gMTtcclxuXHJcbiAgICAgICAgaWYodGhpcy5tb3ZlcyAmJiB0aGlzLm1vdmVzLmxlbmd0aCl7XHJcblxyXG4gICAgICAgICAgICBjdXJyZW50UG9zaXRpb24gPSB0aGlzLm1vdmVzW2ldO1xyXG4gICAgICAgICAgICBhbmdsZSA9IGZpcnN0QW5nbGUgPSBjdXJyZW50UG9zaXRpb24uYW5nbGU7XHJcblxyXG4gICAgICAgICAgICBpZihibGVuZCAmJiB0aGlzLm1vdmVzLmxlbmd0aCA+IDEpe1xyXG4gICAgICAgICAgICAgICAgd2hpbGUoXHJcbiAgICAgICAgICAgICAgICAgICAgLS1pID4gMCAmJlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW92ZXMubGVuZ3RoIC0gaSA8IGJsZW5kU3RlcHMgJiZcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1vdmVzW2ldLnBoYXNlID09PSBwaGFzZVxyXG4gICAgICAgICAgICAgICAgKXtcclxuICAgICAgICAgICAgICAgICAgICBsYXN0QW5nbGUgPSB0aGlzLm1vdmVzW2ldLmFuZ2xlO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmKE1hdGguYWJzKGxhc3RBbmdsZSAtIGZpcnN0QW5nbGUpID4gMTgwKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYW5nbGUgLT0gbGFzdEFuZ2xlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmdsZSArPSBsYXN0QW5nbGU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHN0ZXBzVXNlZCsrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYW5nbGUgPSBhbmdsZS9zdGVwc1VzZWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYoYW5nbGUgPT09IEluZmluaXR5KXtcclxuICAgICAgICAgICAgcmV0dXJuIGZpcnN0QW5nbGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBhbmdsZTtcclxuICAgIH0sXHJcbiAgICBnZXRBbGxJbnRlcmFjdGlvbnM6IGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmV0dXJuIGludGVyYWN0aW9ucy5zbGljZSgpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZnVuY3Rpb24gc3RhcnQoZXZlbnQpe1xyXG4gICAgdmFyIHRvdWNoO1xyXG5cclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1tpXTtcclxuICAgICAgICBuZXcgSW50ZXJhY3Rpb24oZXZlbnQsIGV2ZW50LmNoYW5nZWRUb3VjaGVzW2ldKS5zdGFydChldmVudCwgdG91Y2gpO1xyXG4gICAgfVxyXG59XHJcbmZ1bmN0aW9uIGRyYWcoZXZlbnQpe1xyXG4gICAgdmFyIHRvdWNoO1xyXG5cclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1tpXTtcclxuICAgICAgICBnZXRJbnRlcmFjdGlvbih0b3VjaC5pZGVudGlmaWVyKS5kcmFnKGV2ZW50LCB0b3VjaCk7XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gZW5kKGV2ZW50KXtcclxuICAgIHZhciB0b3VjaDtcclxuXHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgZXZlbnQuY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpKyspe1xyXG4gICAgICAgIHRvdWNoID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbaV07XHJcbiAgICAgICAgZ2V0SW50ZXJhY3Rpb24odG91Y2guaWRlbnRpZmllcikuZW5kKGV2ZW50LCB0b3VjaCkuZGVzdHJveSgpO1xyXG4gICAgfVxyXG59XHJcbmZ1bmN0aW9uIGNhbmNlbChldmVudCl7XHJcbiAgICB2YXIgdG91Y2g7XHJcblxyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSsrKXtcclxuICAgICAgICB0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzW2ldO1xyXG4gICAgICAgIGdldEludGVyYWN0aW9uKHRvdWNoLmlkZW50aWZpZXIpLmNhbmNlbChldmVudCwgdG91Y2gpLmRlc3Ryb3koKTtcclxuICAgIH1cclxufVxyXG5cclxuYWRkRXZlbnQoZCwgJ3RvdWNoc3RhcnQnLCBzdGFydCk7XHJcbmFkZEV2ZW50KGQsICd0b3VjaG1vdmUnLCBkcmFnKTtcclxuYWRkRXZlbnQoZCwgJ3RvdWNoZW5kJywgZW5kKTtcclxuYWRkRXZlbnQoZCwgJ3RvdWNoY2FuY2VsJywgY2FuY2VsKTtcclxuXHJcbnZhciBtb3VzZUlzRG93biA9IGZhbHNlO1xyXG5hZGRFdmVudChkLCAnbW91c2Vkb3duJywgZnVuY3Rpb24oZXZlbnQpe1xyXG4gICAgbW91c2VJc0Rvd24gPSB0cnVlO1xyXG5cclxuICAgIGlmKCFpbnRlcmFjdGlvbnMubGVuZ3RoKXtcclxuICAgICAgICBuZXcgSW50ZXJhY3Rpb24oZXZlbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBpbnRlcmFjdGlvbiA9IGdldEludGVyYWN0aW9uKCk7XHJcblxyXG4gICAgaWYoIWludGVyYWN0aW9uKXtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0SW50ZXJhY3Rpb24oKS5zdGFydChldmVudCk7XHJcbn0pO1xyXG5hZGRFdmVudChkLCAnbW91c2Vtb3ZlJywgZnVuY3Rpb24oZXZlbnQpe1xyXG4gICAgaWYoIWludGVyYWN0aW9ucy5sZW5ndGgpe1xyXG4gICAgICAgIG5ldyBJbnRlcmFjdGlvbihldmVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGludGVyYWN0aW9uID0gZ2V0SW50ZXJhY3Rpb24oKTtcclxuXHJcbiAgICBpZighaW50ZXJhY3Rpb24pe1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZihtb3VzZUlzRG93bil7XHJcbiAgICAgICAgaW50ZXJhY3Rpb24uZHJhZyhldmVudCk7XHJcbiAgICB9ZWxzZXtcclxuICAgICAgICBpbnRlcmFjdGlvbi5tb3ZlKGV2ZW50KTtcclxuICAgIH1cclxufSk7XHJcbmFkZEV2ZW50KGQsICdtb3VzZXVwJywgZnVuY3Rpb24oZXZlbnQpe1xyXG4gICAgbW91c2VJc0Rvd24gPSBmYWxzZTtcclxuXHJcbiAgICB2YXIgaW50ZXJhY3Rpb24gPSBnZXRJbnRlcmFjdGlvbigpO1xyXG5cclxuICAgIGlmKCFpbnRlcmFjdGlvbil7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGludGVyYWN0aW9uLmVuZChldmVudCwgbnVsbCk7XHJcbiAgICBpbnRlcmFjdGlvbi5kZXN0cm95KCk7XHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gYWRkRXZlbnQoZWxlbWVudCwgdHlwZSwgY2FsbGJhY2spIHtcclxuICAgIGlmKGVsZW1lbnQgPT0gbnVsbCl7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcil7XHJcbiAgICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrLCB7IHBhc3NpdmU6IGZhbHNlIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZihkLmF0dGFjaEV2ZW50KXtcclxuICAgICAgICBlbGVtZW50LmF0dGFjaEV2ZW50KFwib25cIisgdHlwZSwgY2FsbGJhY2ssIHsgcGFzc2l2ZTogZmFsc2UgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaW50ZXJhY3Q7IiwiLy9Db3B5cmlnaHQgKEMpIDIwMTIgS29yeSBOdW5uXHJcblxyXG4vL1Blcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XHJcblxyXG4vL1RoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG5cclxuLy9USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cclxuXHJcbi8qXHJcblxyXG4gICAgVGhpcyBjb2RlIGlzIG5vdCBmb3JtYXR0ZWQgZm9yIHJlYWRhYmlsaXR5LCBidXQgcmF0aGVyIHJ1bi1zcGVlZCBhbmQgdG8gYXNzaXN0IGNvbXBpbGVycy5cclxuXHJcbiAgICBIb3dldmVyLCB0aGUgY29kZSdzIGludGVudGlvbiBzaG91bGQgYmUgdHJhbnNwYXJlbnQuXHJcblxyXG4gICAgKioqIElFIFNVUFBPUlQgKioqXHJcblxyXG4gICAgSWYgeW91IHJlcXVpcmUgdGhpcyBsaWJyYXJ5IHRvIHdvcmsgaW4gSUU3LCBhZGQgdGhlIGZvbGxvd2luZyBhZnRlciBkZWNsYXJpbmcgY3JlbC5cclxuXHJcbiAgICB2YXIgdGVzdERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxyXG4gICAgICAgIHRlc3RMYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XHJcblxyXG4gICAgdGVzdERpdi5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgJ2EnKTtcclxuICAgIHRlc3REaXZbJ2NsYXNzTmFtZSddICE9PSAnYScgPyBjcmVsLmF0dHJNYXBbJ2NsYXNzJ10gPSAnY2xhc3NOYW1lJzp1bmRlZmluZWQ7XHJcbiAgICB0ZXN0RGl2LnNldEF0dHJpYnV0ZSgnbmFtZScsJ2EnKTtcclxuICAgIHRlc3REaXZbJ25hbWUnXSAhPT0gJ2EnID8gY3JlbC5hdHRyTWFwWyduYW1lJ10gPSBmdW5jdGlvbihlbGVtZW50LCB2YWx1ZSl7XHJcbiAgICAgICAgZWxlbWVudC5pZCA9IHZhbHVlO1xyXG4gICAgfTp1bmRlZmluZWQ7XHJcblxyXG5cclxuICAgIHRlc3RMYWJlbC5zZXRBdHRyaWJ1dGUoJ2ZvcicsICdhJyk7XHJcbiAgICB0ZXN0TGFiZWxbJ2h0bWxGb3InXSAhPT0gJ2EnID8gY3JlbC5hdHRyTWFwWydmb3InXSA9ICdodG1sRm9yJzp1bmRlZmluZWQ7XHJcblxyXG5cclxuXHJcbiovXHJcblxyXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcclxuICAgIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcclxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAgICAgZGVmaW5lKGZhY3RvcnkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByb290LmNyZWwgPSBmYWN0b3J5KCk7XHJcbiAgICB9XHJcbn0odGhpcywgZnVuY3Rpb24gKCkge1xyXG4gICAgLy8gYmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zODQyODYvamF2YXNjcmlwdC1pc2RvbS1ob3ctZG8teW91LWNoZWNrLWlmLWEtamF2YXNjcmlwdC1vYmplY3QtaXMtYS1kb20tb2JqZWN0XHJcbiAgICB2YXIgaXNOb2RlID0gdHlwZW9mIE5vZGUgPT09ICdmdW5jdGlvbidcclxuICAgICAgICA/IGZ1bmN0aW9uIChvYmplY3QpIHsgcmV0dXJuIG9iamVjdCBpbnN0YW5jZW9mIE5vZGU7IH1cclxuICAgICAgICA6IGZ1bmN0aW9uIChvYmplY3QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9iamVjdFxyXG4gICAgICAgICAgICAgICAgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCdcclxuICAgICAgICAgICAgICAgICYmIHR5cGVvZiBvYmplY3Qubm9kZVR5cGUgPT09ICdudW1iZXInXHJcbiAgICAgICAgICAgICAgICAmJiB0eXBlb2Ygb2JqZWN0Lm5vZGVOYW1lID09PSAnc3RyaW5nJztcclxuICAgICAgICB9O1xyXG4gICAgdmFyIGlzQXJyYXkgPSBmdW5jdGlvbihhKXsgcmV0dXJuIGEgaW5zdGFuY2VvZiBBcnJheTsgfTtcclxuICAgIHZhciBhcHBlbmRDaGlsZCA9IGZ1bmN0aW9uKGVsZW1lbnQsIGNoaWxkKSB7XHJcbiAgICAgIGlmKCFpc05vZGUoY2hpbGQpKXtcclxuICAgICAgICAgIGNoaWxkID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xyXG4gICAgfTtcclxuXHJcblxyXG4gICAgZnVuY3Rpb24gY3JlbCgpe1xyXG4gICAgICAgIHZhciBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCxcclxuICAgICAgICAgICAgYXJncyA9IGFyZ3VtZW50cywgLy9Ob3RlOiBhc3NpZ25lZCB0byBhIHZhcmlhYmxlIHRvIGFzc2lzdCBjb21waWxlcnMuIFNhdmVzIGFib3V0IDQwIGJ5dGVzIGluIGNsb3N1cmUgY29tcGlsZXIuIEhhcyBuZWdsaWdhYmxlIGVmZmVjdCBvbiBwZXJmb3JtYW5jZS5cclxuICAgICAgICAgICAgZWxlbWVudCA9IGFyZ3NbMF0sXHJcbiAgICAgICAgICAgIGNoaWxkLFxyXG4gICAgICAgICAgICBzZXR0aW5ncyA9IGFyZ3NbMV0sXHJcbiAgICAgICAgICAgIGNoaWxkSW5kZXggPSAyLFxyXG4gICAgICAgICAgICBhcmd1bWVudHNMZW5ndGggPSBhcmdzLmxlbmd0aCxcclxuICAgICAgICAgICAgYXR0cmlidXRlTWFwID0gY3JlbC5hdHRyTWFwO1xyXG5cclxuICAgICAgICBlbGVtZW50ID0gaXNOb2RlKGVsZW1lbnQpID8gZWxlbWVudCA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoZWxlbWVudCk7XHJcbiAgICAgICAgLy8gc2hvcnRjdXRcclxuICAgICAgICBpZihhcmd1bWVudHNMZW5ndGggPT09IDEpe1xyXG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKHR5cGVvZiBzZXR0aW5ncyAhPT0gJ29iamVjdCcgfHwgaXNOb2RlKHNldHRpbmdzKSB8fCBpc0FycmF5KHNldHRpbmdzKSkge1xyXG4gICAgICAgICAgICAtLWNoaWxkSW5kZXg7XHJcbiAgICAgICAgICAgIHNldHRpbmdzID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHNob3J0Y3V0IGlmIHRoZXJlIGlzIG9ubHkgb25lIGNoaWxkIHRoYXQgaXMgYSBzdHJpbmdcclxuICAgICAgICBpZigoYXJndW1lbnRzTGVuZ3RoIC0gY2hpbGRJbmRleCkgPT09IDEgJiYgdHlwZW9mIGFyZ3NbY2hpbGRJbmRleF0gPT09ICdzdHJpbmcnICYmIGVsZW1lbnQudGV4dENvbnRlbnQgIT09IHVuZGVmaW5lZCl7XHJcbiAgICAgICAgICAgIGVsZW1lbnQudGV4dENvbnRlbnQgPSBhcmdzW2NoaWxkSW5kZXhdO1xyXG4gICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICBmb3IoOyBjaGlsZEluZGV4IDwgYXJndW1lbnRzTGVuZ3RoOyArK2NoaWxkSW5kZXgpe1xyXG4gICAgICAgICAgICAgICAgY2hpbGQgPSBhcmdzW2NoaWxkSW5kZXhdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKGNoaWxkID09IG51bGwpe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChpc0FycmF5KGNoaWxkKSkge1xyXG4gICAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGkgPCBjaGlsZC5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFwcGVuZENoaWxkKGVsZW1lbnQsIGNoaWxkW2ldKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgYXBwZW5kQ2hpbGQoZWxlbWVudCwgY2hpbGQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IodmFyIGtleSBpbiBzZXR0aW5ncyl7XHJcbiAgICAgICAgICAgIGlmKCFhdHRyaWJ1dGVNYXBba2V5XSl7XHJcbiAgICAgICAgICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShrZXksIHNldHRpbmdzW2tleV0pO1xyXG4gICAgICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgICAgIHZhciBhdHRyID0gY3JlbC5hdHRyTWFwW2tleV07XHJcbiAgICAgICAgICAgICAgICBpZih0eXBlb2YgYXR0ciA9PT0gJ2Z1bmN0aW9uJyl7XHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cihlbGVtZW50LCBzZXR0aW5nc1trZXldKTtcclxuICAgICAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKGF0dHIsIHNldHRpbmdzW2tleV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZWxlbWVudDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBVc2VkIGZvciBtYXBwaW5nIG9uZSBraW5kIG9mIGF0dHJpYnV0ZSB0byB0aGUgc3VwcG9ydGVkIHZlcnNpb24gb2YgdGhhdCBpbiBiYWQgYnJvd3NlcnMuXHJcbiAgICAvLyBTdHJpbmcgcmVmZXJlbmNlZCBzbyB0aGF0IGNvbXBpbGVycyBtYWludGFpbiB0aGUgcHJvcGVydHkgbmFtZS5cclxuICAgIGNyZWxbJ2F0dHJNYXAnXSA9IHt9O1xyXG5cclxuICAgIC8vIFN0cmluZyByZWZlcmVuY2VkIHNvIHRoYXQgY29tcGlsZXJzIG1haW50YWluIHRoZSBwcm9wZXJ0eSBuYW1lLlxyXG4gICAgY3JlbFtcImlzTm9kZVwiXSA9IGlzTm9kZTtcclxuXHJcbiAgICByZXR1cm4gY3JlbDtcclxufSkpO1xyXG4iLCJ2YXIgaW50ZXJhY3QgPSByZXF1aXJlKCcuLycpLFxyXG4gICAgY3JlbCA9IHJlcXVpcmUoJ2NyZWwnKTtcclxuXHJcbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbigpe1xyXG5cclxuICAgIHZhciBsb2cgPSBbXSxcclxuICAgICAgICBvdXRwdXRcclxuXHJcbiAgICBjcmVsKGRvY3VtZW50LmJvZHksXHJcbiAgICAgICAgb3V0cHV0ID0gY3JlbCgnZGl2JylcclxuICAgICk7XHJcblxyXG4gICAgdmFyIHRvTG9nID0gJ3BhZ2VYIHBhZ2VZIGlkZW50aWZpZXIgYW5nbGUnLnNwbGl0KCcgJyk7XHJcblxyXG4gICAgdmFyIGV2ZW50SGFuZGxlciA9IGZ1bmN0aW9uKGludGVyYWN0aW9uKXtcclxuICAgICAgICBpbnRlcmFjdGlvbi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuICAgICAgICBsb2cucHVzaChpbnRlcmFjdGlvbik7XHJcbiAgICAgICAgdmFyIGluZm8gPSAnJztcclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gaW50ZXJhY3Rpb24pe1xyXG4gICAgICAgICAgICBpZih+dG9Mb2cuaW5kZXhPZihrZXkpKXtcclxuICAgICAgICAgICAgICAgIGluZm8gKz0ga2V5ICsgJzogJyArIGludGVyYWN0aW9uW2tleV0gKyAnICc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNyZWwob3V0cHV0LFxyXG4gICAgICAgICAgICBjcmVsKCdwJywgaW50ZXJhY3Rpb24ucGhhc2UsIGNyZWwoJ2JyJyksIGluZm8sIGNyZWwoJ2JyJyksICduaWNlciBhbmdsZTogJyArIGludGVyYWN0aW9uLmdldEN1cnJlbnRBbmdsZSh0cnVlKSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICBpZihvdXRwdXQuY2hpbGROb2Rlcy5sZW5ndGggPiAxMCl7XHJcbiAgICAgICAgICAgIG91dHB1dC5yZW1vdmVDaGlsZChvdXRwdXQuY2hpbGROb2Rlc1swXSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBpbnRlcmFjdC5vbignbW92ZScsIGRvY3VtZW50LmJvZHksIGV2ZW50SGFuZGxlcik7XHJcbiAgICBpbnRlcmFjdC5vbignc3RhcnQnLCBkb2N1bWVudC5ib2R5LCBldmVudEhhbmRsZXIpO1xyXG4gICAgaW50ZXJhY3Qub24oJ2RyYWcnLCBkb2N1bWVudC5ib2R5LCBldmVudEhhbmRsZXIpO1xyXG4gICAgaW50ZXJhY3Qub24oJ2VuZCcsIGRvY3VtZW50LmJvZHksIGV2ZW50SGFuZGxlcik7XHJcbiAgICBpbnRlcmFjdC5vbignY2FuY2VsJywgZG9jdW1lbnQuYm9keSwgZXZlbnRIYW5kbGVyKTtcclxuXHJcbn07Il19
