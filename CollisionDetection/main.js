/*
 * Author : Ph. Meseure
 * Institute : University of Poitiers
 * Note : this code has been freely adapted from Nehe webgl tutorials
*/
var lastTime = 0;
var cumulTime= 0;
var simul;


function tick()
{
  requestAnimFrame(tick);

  let timeNow = new Date().getTime();
  if (lastTime != 0)
  {
    let elapsed = timeNow - lastTime; // in ms
    cumulTime+=elapsed;
    if (cumulTime>30) // 30ms, 33Hz (at most...)
    {
      let elapsedTime=cumulTime/1000.0; // in seconds..
      simul.step(elapsedTime);
      simul.draw();
      cumulTime=0;
    }
  }
  lastTime = timeNow;
}

function startSimul()
{
  var canvas = document.getElementById("webglcanvas");
  initWGL(canvas);
  simul=new Simulation(1.0,1.0,1.0,5);
  simul.initGraphics();

  tick();
}

