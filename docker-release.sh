if [ $# -eq 0 ]
  then
    APPS=$(ls ./apps)
  else
    APPS=$1
fi

for i in $APPS
do
  polaris-cli docker-build "$i"
done

for i in $APPS
do
  docker push "stvnkiss/$i"
done
