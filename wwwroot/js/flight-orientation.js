"use strict";
  
                                                        
                                                                
                                              
                                                                      
                                                                           
                                                         
   
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.SkycraftFlightOrientation = api;
})(typeof window !== "undefined" ? window : null, function () {
    const TWO_PI = Math.PI * 2;
    const wrap = angle => ((angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;

                                                      
    function forward(heading) {
        return { x: Math.sin(heading), z: -Math.cos(heading) };
    }

                                                          
    function modelYaw(heading) {
        return wrap(Math.PI - heading);
    }

                                                               
    function chaseOffset(heading, orbitYaw, distance) {
        const angle = (orbitYaw || 0) - heading;
        return { x: Math.sin(angle) * distance, z: Math.cos(angle) * distance };
    }

                                                                          
                                                                             
                                                                              
    function cameraRelativeInput(input, orbitYaw) {
        const angle = orbitYaw || 0;
        const forwardAxis = Number(input.forward) || 0;
        const rightAxis = Number(input.right) || 0;
        return {
            ...input,
            forward: forwardAxis * Math.cos(angle) + rightAxis * Math.sin(angle),
            right: -forwardAxis * Math.sin(angle) + rightAxis * Math.cos(angle)
        };
    }

    return Object.freeze({ forward, modelYaw, chaseOffset, cameraRelativeInput });
});
