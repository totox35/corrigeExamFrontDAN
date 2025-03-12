import { RouterModule, Routes } from '@angular/router';

import { UserRouteAccessService } from 'app/core/auth/user-route-access.service';
import { ResponseGroupListComponent } from '../list/response-group.list.component';
import { ResponseGroupDetailComponent } from '../detail/response-group-detail.component';
import { ResponseGroupUpdateComponent } from '../update/response-group-update.component';
import { ResponseGroupRoutingResolveService } from '../route/response-groupe-routing-resolve.service.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { ResponseGroupDeleteComponent } from '../delete/response-group-delete-dialog.component';

const responseGroupRoute: Routes = [
  {
    path: '',
    component: ResponseGroupListComponent,
    data: {
      pageTitle: 'Response Groups',
    },
  },
  {
    path: ':id/view',
    component: ResponseGroupDetailComponent,
    resolve: {
      responseGroup: ResponseGroupRoutingResolveService,
    },
    data: {
      pageTitle: 'Response Group Details',
    },
  },
  {
    path: ':id/edit',
    component: ResponseGroupUpdateComponent,
    resolve: {
      responseGroup: ResponseGroupRoutingResolveService,
    },
    data: {
      pageTitle: 'Edit Response Group',
    },
  },
  {
    path: ':id/delete',
    component: ResponseGroupDeleteComponent,
    resolve: {
      responseGroup: ResponseGroupRoutingResolveService,
    },
    outlet: 'popup',
    data: {
      pageTitle: 'Delete Response Group',
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(responseGroupRoute), CommonModule],
  exports: [RouterModule, FormsModule],
})
export class ResponseGroupRoutingModule {}
