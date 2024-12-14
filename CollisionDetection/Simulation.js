/*
 * Author : Ph. Meseure
 * Institute : University of Poitiers
*/
function Simulation(sizex,sizey,sizez,nb)
{
  /* Constructor */
  /* ----------- */
  // rotation angle of the observer
  this.rotview = 0.0;

  // Graphics Objects
  this.box=new WireframeBox();
  
  let polyhedra=[];
  for(let i=0;i<PolyhedronTypes.MAX_TYPES;i++)
    polyhedra.push(new Polyhedron(i)); // create each type of polyhedron
    
  // balls' definition
  this.objects=[];
  for(let i=0;i<nb;i++)
  {
    let r=0.04+Math.random()*0.07;
    let m=100.0*r*r*r; /* ball are made of the same matter and are homogeneous */
    let l=2.0*m;
    color=[Math.random()*0.7+0.3,Math.random()*0.7+0.3,Math.random()*0.7+0.3,1.0];
    let startangle=(Math.random())*2.0*Math.PI;
    let radiusx=Math.random()*sizex;
    let radiusz=Math.random()*sizez;
    let angularvel=(Math.random()-0.5)*10; // m/s
    let deviation=(Math.random())*2.0*Math.PI;
    let inclination=(Math.random())*2.0*Math.PI;
    let polysize=Math.random()*sizex/20.0+sizex/30.0;

    let polytype=Math.floor(Math.random()*PolyhedronTypes.MAX_TYPES);
    if (polytype==PolyhedronTypes.MAX_TYPES) polytype--; // just in case...
    
    let object=new VirtualObject(this,polyhedra[polytype],color,polysize,startangle,
                            radiusx,radiusz,angularvel,deviation,inclination);
    this.objects.push(object);
  }

  const range = (end) => Array.from({length: end}, (_, i) => i);

  this.sorted_x = range(this.objects.length); 
  this.sorted_y = range(this.objects.length);
  this.sorted_z = range(this.objects.length);

  this.bubbleSort(this.sorted_x, 0); // Tri par rapport à l'axe x
  this.bubbleSort(this.sorted_y, 1); // Tri par rapport à l'axe y
  this.bubbleSort(this.sorted_z, 2); // Tri par rapport à l'axe z
}
  
/*
 * Simulation step : state of box and balls go one dt further in time
 */
Simulation.prototype.step = function (elapsed)
{ 
  for(let i=0;i<this.objects.length;i++)
  {
    this.objects[i].step(elapsed); // Move each polyhedron
  }

  // Réorganise les trois listes triées
  this.bubbleSort(this.sorted_x, 0); 
  this.bubbleSort(this.sorted_y, 1); 
  this.bubbleSort(this.sorted_z, 2); 

  // Matrices de chevauchement
  let overlap_x = this.checkOverlaps(this.sorted_x, 0);
  let overlap_y = this.checkOverlaps(this.sorted_y, 1);
  
  // Vérification des collisions
  for (let i = 0; i < this.objects.length - 1; i++) 
  {
    const idxI = this.sorted_z[i];
    const objI = this.objects[idxI];
    for (let j = i + 1; j < this.objects.length; j++) 
    {    
      const idxJ = this.sorted_z[j];
      const objJ = this.objects[idxJ];

      if (objI.boxmax[2] > objJ.boxmin[2]) 
      {
        if ((idxI < idxJ && overlap_x[idxI][idxJ] && overlap_y[idxI][idxJ]) || overlap_x[idxJ][idxI] && overlap_y[idxJ][idxI])
        {
          if (!objI.treeRoot.compareAABB(objJ.treeRoot)) continue;
          let collisions = [];
          objI.treeRoot.checkCollisions(objJ.treeRoot, collisions);

          if (collisions.length > 0) 
          {
            objI.collision = true;
            objJ.collision = true;
          }
        }
      } else break;
    }
  }
  
  // modify view angle by the way of a rotation velocity in rad/s
  //  this.rotview += elapsed*1e-1;
}
  
/*
 * Initialization of graphical elements
 */
Simulation.prototype.initGraphics = function()
{
  let pmatrix=mat4.create();    
  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pmatrix);
  setProjectionMatrix(pmatrix);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
  setLighting(true);
  setAmbiantLight([0.2,0.2,0.2,1.0]);
  setLightPosition([10.0,20.0,10.0]);
  setLightColor([0.8,0.8,0.8,1.0]);
  setLightSpecular([1.0,1.0,1.0,1.0]);
  setLightAttenuation(1.0,0.0,0.0);
  setNormalizing(true);
}

/*
 * Drawing function
 */
Simulation.prototype.draw = function()
{
  let mvmatrix = mat4.create();
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.identity(mvmatrix);
  mat4.translate(mvmatrix, [0.0, 0.0, -2.2]);
//  mat4.rotate(mvmatrix, Math.PI/6.0, [1, 0, 0]);
  mat4.rotate(mvmatrix, this.rotview, [0, 1, 0]);
  
  for(let i=0;i<this.objects.length;i++)
  {
    let obj=this.objects[i];
    pushMatrix(mvmatrix);
    {
      obj.draw(mvmatrix);
    }
    mvmatrix=popMatrix();

    // Uncomment following lines to display bounding boxes    
    // setLighting(false);
    // pushMatrix(mvmatrix);
    // {
    //   obj.drawAABB(mvmatrix,this.box);
    // }
    // mvmatrix=popMatrix();
    // setLighting(true);
  }
}

Simulation.prototype.bubbleSort = function (array, axis) {
  let swapped;
  let n = array.length;
  // Fonction d'accès aux objets de la liste triée
  const objects = (i) => this.objects[array[i]];
  do {
    swapped = false;
    for (let i = 0; i < n - 1; i++) {
      if (objects(i).boxmin[axis] > objects(i + 1).boxmin[axis]) {
        [array[i], array[i + 1]] = [array[i + 1], array[i]];
        swapped = true;
      }
    }
    n--;
  } while (swapped);
}

Simulation.prototype.checkOverlaps = function (sortedList, axis) {
  const n = sortedList.length;
  // Matrice triangulaire supérieure
  let overlapMatrix = Array.from(Array(n), () => Array(n).fill(false)); 
  
  for (let i = 0; i < n - 1; i++) {
    const idxI = sortedList[i];
    const objI = this.objects[idxI];
    for (let j = i + 1; j < n; j++) {  
      const idxJ = sortedList[j];  
      const objJ = this.objects[idxJ];

      if (objI.boxmax[axis] > objJ.boxmin[axis]) {
        if (idxI < idxJ)
          overlapMatrix[idxI][idxJ] = true;
        else
          overlapMatrix[idxJ][idxI] = true;
      } else {
        break;
      }
    }
  }
  return overlapMatrix;
}




