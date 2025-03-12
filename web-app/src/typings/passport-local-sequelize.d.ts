declare module 'passport-local-sequelize' {
    import { Sequelize, Model, ModelCtor, DataTypes } from 'sequelize';

    interface PassportLocalSequelize {
        attachToUser: (User: ModelCtor<Model<any, any>>, options?: any) => void;
        defineUser: (sequelize: Sequelize, options?: any) => ModelCtor<Model<any, any>>;
        authenticate: () => any;
        createStrategy:() => any;
        serializeUser: () => any;
        deserializeUser: () => any;
    }

    const passportLocalSequelize: PassportLocalSequelize;
    export = passportLocalSequelize;
}