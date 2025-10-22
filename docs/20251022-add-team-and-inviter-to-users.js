'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'team', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'none'
    });

    await queryInterface.addColumn('Users', 'invitedById', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    });

    // Add index for faster lookups by team
    await queryInterface.addIndex('Users', ['team'], {
      name: 'users_team_idx'
    });

    // Add index for inviter relationship
    await queryInterface.addIndex('Users', ['invitedById'], {
      name: 'users_invitedby_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('Users', 'users_team_idx');
    await queryInterface.removeIndex('Users', 'users_invitedby_idx');

    // Remove columns
    await queryInterface.removeColumn('Users', 'team');
    await queryInterface.removeColumn('Users', 'invitedById');
  }
};


// Or use SQL commands directlty:

// -- Add the 'team' column with default 'none'
// ALTER TABLE Users
//   ADD COLUMN team VARCHAR(255) NULL DEFAULT 'none';

// -- Add the 'invitedById' column as a foreign key (nullable)
// ALTER TABLE Users
//   ADD COLUMN invitedById INT NULL,
//   ADD INDEX users_invitedby_idx (invitedById);

// -- Add an index for the 'team' column
// CREATE INDEX users_team_idx ON Users (team);

// -- Optionally, add a foreign key constraint (if you want strict referential integrity)
// ALTER TABLE Users
//   ADD CONSTRAINT fk_invitedBy
//     FOREIGN KEY (invitedById) REFERENCES Users(id)
//     ON DELETE SET NULL
//     ON UPDATE CASCADE;