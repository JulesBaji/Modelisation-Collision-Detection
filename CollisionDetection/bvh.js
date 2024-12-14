function TreeNode(triangles, left = null, right = null, boxmin = null, boxmax = null) 
{
    this.triangles = triangles; 
    this.boxmin = boxmin;       
    this.boxmax = boxmax;      
    this.left = left;          
    this.right = right;        
}
  
TreeNode.prototype.buildTriangleTree = function (virtualObject) 
{
    positions = virtualObject.globject.positions;
    triangles = virtualObject.globject.triangles;
    const posmatrix = mat4.create();
    mat4.identity(posmatrix);
    virtualObject.applyTranformations(posmatrix);
    
    function computeTriangleCenter(indices) 
    {
        let center = vec3.create();
        vec3.add(positions[indices[0]], positions[indices[1]], center);
        vec3.add(center, positions[indices[2]]);
        vec3.scale(center, 1 / 3);
        return center;
    }

    function buildTree(triangleIndices) 
    {
        if (triangleIndices.length === 1) return new TreeNode(triangleIndices);

        let axisBounds = { 
            x: [Number.MAX_VALUE, -Number.MAX_VALUE], 
            y: [Number.MAX_VALUE, -Number.MAX_VALUE], 
            z: [Number.MAX_VALUE, -Number.MAX_VALUE] 
        };
        triangleIndices.forEach(indices => {
            const center = computeTriangleCenter(indices);
            axisBounds.x[0] = Math.min(axisBounds.x[0], center[0]);
            axisBounds.x[1] = Math.max(axisBounds.x[1], center[0]);
            axisBounds.y[0] = Math.min(axisBounds.y[0], center[1]);
            axisBounds.y[1] = Math.max(axisBounds.y[1], center[1]);
            axisBounds.z[0] = Math.min(axisBounds.z[0], center[2]);
            axisBounds.z[1] = Math.max(axisBounds.z[1], center[2]);
        });

        let dominantAxis = ['x', 'y', 'z'].reduce((dominant, axis) => {
            const length = axisBounds[axis][1] - axisBounds[axis][0];
            const dominantLength = axisBounds[dominant][1] - axisBounds[dominant][0];
            return length > dominantLength ? axis : dominant;
        }, 'x');

        triangleIndices.sort((a, b) => {
            const centerA = computeTriangleCenter(a);
            const centerB = computeTriangleCenter(b);
            return centerA[dominantAxis] - centerB[dominantAxis];
        });

        let medianIndex = Math.floor(triangleIndices.length / 2);
        let leftTriangles = triangleIndices.slice(0, medianIndex);
        let rightTriangles = triangleIndices.slice(medianIndex);

        let leftNode = buildTree(leftTriangles);
        let rightNode = buildTree(rightTriangles);

        return new TreeNode(null, leftNode, rightNode);
    }

    let triangleGroups = [];
    for (let i = 0; i < triangles.length; i += 3) 
    {
        triangleGroups.push([triangles[i], triangles[i + 1], triangles[i + 2]]);
    }

    return buildTree(triangleGroups);
};

TreeNode.prototype.updateAABBs = function (virtualObject)
{
    positions = virtualObject.globject.positions;
    const posmatrix = mat4.create();
    mat4.identity(posmatrix);
    virtualObject.applyTranformations(posmatrix);

    function computeAABB(triangleIndices) 
    {
        let boxmin = vec3.create();
        let boxmax = vec3.create();
        boxmin[0] = boxmin[1] = boxmin[2] = Number.MAX_VALUE;
        boxmax[0] = boxmax[1] = boxmax[2] = -Number.MAX_VALUE;
        let pos=vec3.create();
    
        triangleIndices.forEach(indices => {
            indices.forEach(index => {
                mat4.multiplyVec3(posmatrix, positions[index], pos);
                vec3.min(boxmin, pos);
                vec3.max(boxmax, pos);
            });
        });

        return { boxmin, boxmax };;
    }

    if (this.left === null && this.right === null) {
        const { boxmin, boxmax } = computeAABB(this.triangles);
        this.boxmin = boxmin;
        this.boxmax = boxmax;
    } else {
        if (this.left) this.left.updateAABBs(virtualObject);
        if (this.right) this.right.updateAABBs(virtualObject);
        if (!this.boxmin) this.boxmin = vec3.create();
        if (!this.boxmax) this.boxmax = vec3.create();
        vec3.min(this.left.boxmin, this.right.boxmin, this.boxmin);
        vec3.max(this.left.boxmax, this.right.boxmax, this.boxmax);
    }
};

TreeNode.prototype.checkCollisions = function (otherNode, collisions) {

    function computeVolume(boxmin, boxmax) {
        return (boxmax[0] - boxmin[0]) * (boxmax[1] - boxmin[1]) * (boxmax[2] - boxmin[2]);
    }

    if (!this.compareAABB(otherNode)) return;

    if (!this.left && !this.right && !otherNode.left && !otherNode.right) {
        collisions.push({ trianglesA: this.triangles, trianglesB: otherNode.triangles });
    } else {
        const volumeThis = computeVolume(this.boxmin, this.boxmax);
        const volumeOther = computeVolume(otherNode.boxmin, otherNode.boxmax);

        if (volumeThis > volumeOther) {
        if (this.left) this.left.checkCollisions(otherNode, collisions);
        if (this.right) this.right.checkCollisions(otherNode, collisions);
        } else {
        if (otherNode.left) this.checkCollisions(otherNode.left, collisions);
        if (otherNode.right) this.checkCollisions(otherNode.right, collisions);
        }
    }
};

TreeNode.prototype.compareAABB = function (otherNode) {
    return !(
        this.boxmin[0] > otherNode.boxmax[0] || this.boxmax[0] < otherNode.boxmin[0] || // Axe X
        this.boxmin[1] > otherNode.boxmax[1] || this.boxmax[1] < otherNode.boxmin[1] || // Axe Y
        this.boxmin[2] > otherNode.boxmax[2] || this.boxmax[2] < otherNode.boxmin[2]    // Axe Z
    );
};