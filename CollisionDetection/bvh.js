function TreeNode(triangles, boxmin, boxmax, left = null, right = null) 
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

    function computeAABB(triangleIndices) 
    {
        let boxmin = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        let boxmax = vec3.fromValues(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
        let pos=vec3.create();
    
        triangleIndices.forEach(indices => {
            [positions[indices[0]], positions[indices[1]], positions[indices[2]]].forEach(vertex => {
                mat4.multiplyVec3(posmatrix,vertex,pos);
                vec3.min(boxmin, pos);
                vec3.max(boxmax, pos);
            });
        });

        return { boxmin, boxmax };
    }
    
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
        if (triangleIndices.length === 1) {
            const { boxmin, boxmax } = computeAABB(triangleIndices);
            return new TreeNode(triangleIndices, boxmin, boxmax);
        }
        
        // Trouver un moyen de calculer la mediane sans les boxmin et boxmax
        const { boxmin, boxmax } = computeAABB(triangleIndices);
        
        let centersWithIndex = triangleIndices.map(indices => ({
            center: computeTriangleCenter(indices),
            indices
        }));

        let axisLengths = vec3.subtract(vec3.create(), boxmax, boxmin);
        let dominantAxis = axisLengths.indexOf(Math.max(...axisLengths));

        centersWithIndex.sort((a, b) => a.center[dominantAxis] - b.center[dominantAxis]);

        let medianIndex = Math.floor(centersWithIndex.length / 2);
        let leftTriangles = centersWithIndex.slice(0, medianIndex).map(item => item.indices);
        let rightTriangles = centersWithIndex.slice(medianIndex).map(item => item.indices);

        let leftNode = buildTree(leftTriangles);
        let rightNode = buildTree(rightTriangles);

        // let combinedBoxMin = vec3.min(vec3.create(), leftNode.boxmin, rightNode.boxmin);
        // let combinedBoxMax = vec3.max(vec3.create(), leftNode.boxmax, rightNode.boxmax);

        // return new TreeNode(null, combinedBoxMin, combinedBoxMax, leftNode, rightNode);
        return new TreeNode(null, boxmin, boxmax, leftNode, rightNode);
    }

    if (triangles.length % 3 !== 0) {
        throw new Error("Invalid triangle data: number of indices must be a multiple of 3.");
    }

    let triangleGroups = [];
    for (let i = 0; i < triangles.length; i += 3) 
    {
        triangleGroups.push([triangles[i], triangles[i + 1], triangles[i + 2]]);
    }

    return buildTree(triangleGroups);
};

TreeNode.prototype.updateAABBs = function ()
{
    if (this.left === null && this.right === null) {
        const { boxmin, boxmax } = computeAABB(this.triangles);
        this.boxmin = boxmin;
        this.boxmax = boxmax;
    } else {
        if (this.left) this.left.updateAABBs();
        if (this.right) this.right.updateAABBs();
        this.boxmin = vec3.min(vec3.create(), this.left.boxmin, this.right.boxmin);
        this.boxmax = vec3.max(vec3.create(), this.left.boxmax, this.right.boxmax);
    }
};