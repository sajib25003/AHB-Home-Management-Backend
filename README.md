For production in vercel: vercel --prod

| Role         | Access                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| `superAdmin` | সম্পূর্ণ system access; সব role create/manage                                              |
| `admin`      | সব owner, tenant, apartment, rent দেখতে/manage করতে পারবে; superAdmin manage করতে পারবে না |
| `owner`      | নিজের apartment, tenant, rent/payment manage করবে; শুধু নিজের tenant create করবে           |
| `tenant`     | assigned apartment ও নিজের rent/payment/receipt দেখবে                                      |
| `user`       | শুধু নিজের personal cashflow ব্যবহার করবে                                                  |

superAdmin → admin, owner, tenant, user
admin → owner, tenant, user
owner → tenant only
tenant → cannot create users
user → cannot create users
