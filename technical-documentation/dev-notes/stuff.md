admin@example.com
ChangeMeOnFirstLogin123!

http://192.168.49.2:30406/

http://192.168.49.2:30406/viper-instances/dzxcn2kr7s53/vnc/index.html?path=/viper-instances/dzxcn2kr7s53/websockify&autoconnect=1



<!-- When the app restarts, the gui sometimes shows error like this:
"Error loading instances: Unexpected token '<', "<html> <h"... is not valid JSON"
Which are I guess it trying to read a 404 html error as json anf failing...? not a masive bummer, but it would be better to show a connection error, and then try and reconnect in 30 seconds -->


<!-- 
Things to address:
Start new instance button, needs a spinning timer or gui effect after its clicked, to let the user know that the click was registered, and then to clear that once we see the new instance 'initializing'....

Delete instance button also needs to give a visual register for the user feedback too

There is a max-height:400 css rule on .card-img-custom css - that aims to keep the odd screen capture images sizes and dimensions from making the horizontal cards look weird when there are a lot, but its cropping the top and bottom of the images, and messing up the carosuel of images

We need to go back and look at the code for the carousel. We are supposed to only save unique images - but without even launching a container, i can see 10 identiicle images have been saved to the database...?

Plus i can no longer cycle throug the 10 images like i could on docker.

I have added some new cloudviper icons to the src/public/images/web-icons folder, i want to use those icons as the faviocn for the website, and we need to look at how we can get this icons into the viper-instances - so they have an icon on their tab too -->





the activity monitor was too agressive in trying to update the graphs in the gui, but i think for 'ready' containers, if the gui is open, then updating randomly around every 30 seconds or so, shopuld be ok, not all at the same time, and not all onthe same random?

if the viper-instances have a database id like an integer, can we have thet inthe admin gui dashbaord, so i can see the numbers, like top right of the card

Inside the viper-instance "applications" drop down menu, there is an added entry by me: 'toggle system monitor'
it starts a desktop widget, can we 'click' that as part of the script injection stuff for the pods?