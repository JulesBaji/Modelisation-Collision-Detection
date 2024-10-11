/*
 * Author : Ph. Meseure
 * Institute : University of Poitiers
*/

/**
 * Virtual Object constructor
 * @param _envi: the simulation scene
 * @param _globject: shape of the object, defined as a polyhedron
 * @param _size: size of the object (the given shape is normalized)
 * @param _starangle, _radiusx, _radiusz,_angvel,_deviation,_inclination: parameters of the trajectory (an ellipse)
 */
function VirtualObject(_envi,_globject,_color,_size,_startangle,_radiusx,_radiusz,_angvel,_deviation,_inclination)
{
  this.envi=_envi;
  
  this.globject=_globject; // Open
  this.color=_color;
  this.size=_size;
  
  // Motion parameters
  // Axial rotations
  this.anglex=0.0;
  this.angley=0.0;
  this.anglez=0.0;
  // Rotation velocity along the trajectory
  this.rotvelx=(Math.random()-0.5)*2; // m/s
  this.rotvely=(Math.random()-0.5)*2; // m/s
  this.rotvelz=(Math.random()-0.5)*2; // m/s

  // position of the ellipsoidal trajectory
  this.rotposy=(Math.random()-0.5)*2; // m/s
  this.posangle=_startangle;
  this.radiusx=_radiusx;
  this.radiusz=_radiusz;
  this.angularvelocity=_angvel;
  this.deviation=_deviation;
  this.inclination=_inclination;

  // Boolean mark telling if a collision was detected for the current object  
  this.collision=false;
  
  // Bottom/left/far corner of the axis-aligned bounding box
  this.boxmin=vec3.create();
  // Top/right/near corner of the axis-aligned bounding box
  this.boxmax=vec3.create();
}

/**
 * Compute a matrix for the global positionning of the object
 * depending on the current state/position values
 * @param mvmatrix: matrix to change to take into account the size and the
 * current position and orientation of the object
 */
VirtualObject.prototype.applyTranformations=function(mvmatrix)
{
  let pos=vec3.create();
  pos[0]=Math.cos(this.posangle)*this.radiusx;
  pos[1]=0.0;
  pos[2]=Math.sin(this.posangle)*this.radiusz;
  
  mat4.rotate(mvmatrix, this.deviation, [0.0, 1.0, 0.0]);
  mat4.rotate(mvmatrix, this.inclination, [0.0, 0.0, 1.0]);
  mat4.translate(mvmatrix,pos);
  mat4.rotate(mvmatrix, this.anglex, [1.0, 0.0, 0.0]);
  mat4.rotate(mvmatrix, this.angley, [0.0, 1.0, 0.0]);
  mat4.rotate(mvmatrix, this.anglez, [0.0, 0.0, 1.0]);
  mat4.uniformscale(mvmatrix,this.size);
}

/*
 * Draw the object
 * @param mvmatrix is the view matrix, it is altered to take into account
 * the size and the position/orientation of the object
 */
VirtualObject.prototype.draw=function(mvmatrix)
{
  this.applyTranformations(mvmatrix);
  setModelViewMatrix(mvmatrix);

  setMaterialSpecular([1.0,1.0,1.0,1.0]);
  setMaterialShininess(200.0);

  if (this.collision)
    setMaterialColor([1.0, 0.0, 0.0, 1.0]);
  else
    setMaterialColor(this.color);
  
  this.globject.draw();
}


/*
 * Draw the object's AABB
 * @param mvmatrix is the view matrix, it is altered to take into account
 * the size of the box for display
 * @param box: graphics object to display to represent a box
 */
VirtualObject.prototype.drawAABB=function(mvmatrix, box)
{
  // Compute center of box
  let pos=vec3.create();
  vec3.add(this.boxmin,this.boxmax,pos);
  vec3.scale(pos,0.5);
  mat4.translate(mvmatrix,pos);
  
  // Compute size of box
  let scale=vec3.create();
  vec3.subtract(this.boxmax,this.boxmin,scale);
  mat4.scale(mvmatrix,scale);
  setModelViewMatrix(mvmatrix);

  setMaterialSpecular([1.0,1.0,1.0,1.0]);
  setMaterialShininess(200.0);

  if (this.collision)
    setMaterialColor([1.0, 0.0, 0.0, 1.0]);
  else
    setMaterialColor([1.0,1.0,1.0,1.0]);
    
  box.drawWireframe();
}

/**
 * Compute next step of the animation
 * It roughly only change the state (position/orientation) attributes
 * of the object
 * @param elapsed: time elapsed since last call. Useful to manage velocities
 */
VirtualObject.prototype.step=function(elapsed)
{
  this.anglex+=this.rotvelx*elapsed;
  this.angley+=this.rotvely*elapsed;
  this.anglez+=this.rotvelz*elapsed;
  this.posangle+=this.angularvelocity*elapsed;
  
  this.collision=false;
  this.computeAABB();
}

/**
 * Compute the current Axis-Aligned Bounding box of the object
 * It depends on the current position/orientation of the object
 */
VirtualObject.prototype.computeAABB=function()
{
  let posmatrix = mat4.create();
  mat4.identity(posmatrix);
  this.applyTranformations(posmatrix);

  let positions=this.globject.positions;
  let pos=vec3.create();

  // mat4.multiplyVec3(posmatrix,positions[0],pos);
  // this.boxmin[0]=this.boxmax[0]=pos[0];
  // this.boxmin[1]=this.boxmax[1]=pos[1];
  // this.boxmin[2]=this.boxmax[2]=pos[2];

  this.boxmin[0]=this.boxmin[1]=this.boxmin[2]=Number.MAX_VALUE;
  this.boxmax[0]=this.boxmax[1]=this.boxmax[2]=-Number.MAX_VALUE;

  for(let i=0;i<positions.length;i++)
  {
    mat4.multiplyVec3(posmatrix,positions[i],pos);

    // update bounding box using "pos" here...
    if(pos[0]<this.boxmin[0]) this.boxmin[0]=pos[0];
    if(pos[1]<this.boxmin[1]) this.boxmin[1]=pos[1];
    if(pos[2]<this.boxmin[2]) this.boxmin[2]=pos[2];
    if(pos[0]>this.boxmax[0]) this.boxmax[0]=pos[0];
    if(pos[1]>this.boxmax[1]) this.boxmax[1]=pos[1];
    if(pos[2]>this.boxmax[2]) this.boxmax[2]=pos[2];
  }
}

/**
 * Compute the axis-aligned bounding box of that object overlap with this' one
 * @param that: other object which bounding box has to be checked for collision
 * @return true if it is the case
 */
VirtualObject.prototype.compareAABB=function(that)
{
  // return true if AABB of this and that intersect
  if(this.boxmin[0]>that.boxmax[0] || this.boxmax[0]<that.boxmin[0]) return false;
  if(this.boxmin[1]>that.boxmax[1] || this.boxmax[1]<that.boxmin[1]) return false;
  if(this.boxmin[2]>that.boxmax[2] || this.boxmax[2]<that.boxmin[2]) return false;
  return true;
}

