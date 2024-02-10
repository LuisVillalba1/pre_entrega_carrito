//importamos crypto el cual nos va ayudar para poder generar ids unicos
import crypto from "crypto";
import {promises as fs} from "fs"

const RUTA = "./database/productos.json";

//le hacemos saber al usuario que propiedades son validas ingresar
function chekIncorrectPropertys(product){
    let properties = ["title","description","code","status","stock","price","thumbnails","category"];

    for(let i in product){
        if(!properties.includes(i)){
            throw new Error(`La propiedad ${i} no es valida solo se permiten las propiedades ${properties.slice("")}`);
        }
    }
}
//verificamos que los campos tengan los valores correctos
function checkPropertys(product){
    //array para verificar que cada campo cuente su tipo de valor correspondiente
    let properties = [["title","string"],["description","string"],["code","string"],["price","number"],["stock","number"],["category","string"],["status","boolean"]]

    for(let i in properties){
        let propertyName = properties[i][0];
        let propertyType = properties[i][1];

        if(!product[propertyName] || typeof product[propertyName] != propertyType){
            throw new Error(`Por favor ingrese un valor de tipo ${propertyType} para la propiedad ${propertyName}`)
        }
    }
}

//verificamos si existe una ruta para el producto, en caso de que no,creamos una nueva
function checkThumbnails(product){
    //en caso de que no exista la ruta de strings o agrege un array vacio lo creamos
    if(!product.thumbnails || !Array.isArray(product.thumbnails) || (product.thumbnails).length == 0){
        product.thumbnails = [(new Date).getTime()+product.title]
    }

    return product;
}

async function checkExistArchivo(RUTA){
    try{
    //en caso de que no exista el archivo nos retornara una exeption
    await fs.stat(RUTA);
    }
    catch(e){
        console.log(e);
    }
}

checkExistArchivo(RUTA);

//creamos nuestro product manager
class ProductManager{
    constructor(path){
        this.products = [];
        this.path = path;
    }

    //obtnemos todos los productos
    async getProducts(limit,res){
        //obtenemos los productos
        let data = await fs.readFile(this.path,"utf-8");
        let response = JSON.parse(data);

        //retornamos los productos, en caso de que exista limite, retornamos los deseados
        if(limit && parseInt(limit) > 0){
            return res.send(response.slice(0,limit))

        }
        //si no existe limit retornamos todos los resultados
        else if(!limit){
            return res.send(response);
        }
        return res.status(404).send("Ingrese un limit correcto")
    }

    //añadimos un nuevo producto y si ya existe le sumamos el stock
    async addProduct(product,res){
        try{
            //mostramos que propiedades son validas ingresar
            chekIncorrectPropertys(product);
            //verificamos que no existan campos nulos y que los campos tengan los valores correspondientes
            checkPropertys(product);
            //creamos en caso de que sea necesario el array de thumbnails
            product = checkThumbnails(product);

            //hacemos que el estatus del producto sea por defecto true
            product.status = true;

            //obtnemos los productos
            let response = await fs.readFile(this.path,"utf-8");
            let products = JSON.parse(response);

            let indice = products.findIndex((item)=>item.code == product.code)

            //agregamos el producto a nuestro archivo json
            if(indice == -1){
                //creamos un codigo unico
                let id = crypto.randomBytes(10).toString("hex");
                product.id = id;
                //agregamos el producto a nuestra base de datos
                products.push(product);
                await fs.writeFile(this.path,JSON.stringify(products));
                return res.send("Producto añadido con exito")
            }
            //sumamos el stock del producto correspondiente
            products[indice].stock += product.stock;
            await fs.writeFile(this.path,JSON.stringify(products));
            return res.send("Producto añadido con exito")
        }
        catch(e){
            if(e instanceof Error){
                return res.status(404).send(e.message);
            }
            return res.status(500).send("Ha ocurrido un error");
        }
    }

    //obtenemos un producto segun su id
    async getProductById(id,res){
        try{
            const products = await fs.readFile(this.path,"utf-8");
            const response = JSON.parse(products);
        
            const product = response.find(item=>item.id == id);
            
            //si se encuentra el producto lo devolvemos, si no lanzamos una exepcion
            if(product){
                return res.send(product);
            }
            
            return res.status(404).send("No se ha encontrado el producto");

        }
        catch(e){
            return res.status(500).sened("Ha ocurrido un error");
        }
    }
    
    //modificamos un producto segun su id y nuevos valores ingresados
    async updateProduct(id,newData,res){
        try{
        //obtenemos los productos
        let response = await fs.readFile(this.path,"utf-8");
        let products = JSON.parse(response);

        //si no se encuentra el producto por el id, lanzamos una exepcion
        let indice = products.findIndex(item=>item.id == id);

        if(indice == -1){
            return res.status(404).send("No se ha encontrado el producto en especifico");
        }

        //obtenemos el producto en concreto con los nuevos valores
        let newValues = changeValues(newData,products[indice]);

        //modificamos los valores y guardamos la informacion
        products[indice] = newValues;

        await fs.writeFile(this.path,JSON.stringify(products));

        return res.status(201).send("Se ha modificado el objeto");
        }
        catch(e){
            if(e instanceof Error){
                return res.status(404).send(e.message)
            }
            return res.send(500).send("Ha ocurrido un error inesperado");
        }
    }

    //eliminamos un producto segun el id
    async deleteProduct(id,res){
        try{
            //obtenemos todos los productos y verificamos que exista el producto ingresado
            const response = await fs.readFile(this.path,"utf-8");
            const products = JSON.parse(response);

            const indeceProduct = products.findIndex(item=>item.id == id);
    
            if(indeceProduct == -1){
                throw new Error("No se ha encontrado el producto")
            }

            //eliminamos el producto
            products.splice(indeceProduct,1);

            await fs.writeFile(this.path,JSON.stringify(products));

            return res.send("Se ha eliminado el producto :c");
        }
        catch(e){
            if(e instanceof Error){
                return res.status(404).send(e.message);
            }
            return res.status(500).send("Ha ocurrido un error inesperado");
        }
    }
}

//cambiamos los valores de un objeto segun otro dado
function changeValues(newData,product){
    //verificamos que sea un objeto el que se haya ingresado
    if(typeof newData != "object" || Object.values(newData).length == 0){
        throw new Error("Por favor ingrese un objeto con propiedades");
    }

    //obtenemos las propiedades del nuevo objeto
    let newDataProperties = Object.keys(newData);
    
    //no permitimos que el nuevo objeto tenga la propiedad id, ya que no lo queremos modificar
    if(newDataProperties.includes("id")){
        throw new Error("No se puede ingresar la propiedad id");
    }

    //obtenemos las propiedades del producto a modificar
    let properties = Object.keys(product);

    //modificamos los valores del producto viejo
    for(let i in newData){
        //en caso de que el producto no cuente con una propiedad valida, enviamos un error
        if(!properties.includes(i)){
            throw new Error(`solo se admiten las propiedades ${properties.slice("")}`)
        }
        else{
            //en caso de que el tipo de dato no coincida enviamos un error
            if(typeof product[i] != typeof newData[i]){
                throw new Error(`Por favor ingrese un valor de tipo ${typeof product[i]} para la propiedad ${i}`)
            }
            product[i] = newData[i]
        }
    }

    return product;
}

//creamos nuestro product manager
export const procesadoresAmd = new ProductManager(RUTA);

//creamos dos productos
// const product1 = createProduct("Procesador ryzen 3600","Procesador serie 3000",20,"../main",1,400);
// const product12 =  createProduct("Procesador ryzen 3700x","Procesador serie 3000",20,"../main",2,800);


